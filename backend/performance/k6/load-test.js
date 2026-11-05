import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const token = __ENV.TOKEN;
const vus = Number(__ENV.VUS || '10');
const duration = __ENV.DURATION || '1m';
const rampUp = __ENV.RAMP_UP || '15s';
const rampDown = __ENV.RAMP_DOWN || '10s';

if (!token) {
  throw new Error('Define TOKEN con un JWT válido de un usuario de SmartPlant.');
}

if (!Number.isInteger(vus) || vus < 1) {
  throw new Error('VUS debe ser un entero mayor o igual a 1.');
}

const endpoints = [
  { name: 'health', path: '/api/health', authenticated: false },
  { name: 'lecturas-actual', path: '/api/lecturas/actual', authenticated: true },
  { name: 'lecturas-historial', path: '/api/lecturas/historial?pagina=1&limite=10', authenticated: true },
  { name: 'alertas-resumen', path: '/api/alertas/resumen', authenticated: true },
  { name: 'dispositivos', path: '/api/dispositivos', authenticated: true },
];

export const options = {
  stages: [
    { duration: rampUp, target: vus },
    { duration, target: vus },
    { duration: rampDown, target: 0 },
  ],
};

export default function () {
  const endpoint = endpoints[__ITER % endpoints.length];
  const headers = endpoint.authenticated
    ? { Authorization: `Bearer ${token}` }
    : {};
  const response = http.get(`${baseUrl}${endpoint.path}`, {
    headers,
    tags: { endpoint: endpoint.name },
  });

  check(response, {
    [`${endpoint.name}: HTTP 200`]: (result) => result.status === 200,
  });

  sleep(1);
}

function metricValue(data, metricName, valueName) {
  const metric = data.metrics[metricName];
  return metric && metric.values[valueName] !== undefined
    ? metric.values[valueName]
    : null;
}

function rounded(value) {
  return value === null ? null : Number(value.toFixed(2));
}

export function handleSummary(data) {
  const checkPassRate = metricValue(data, 'checks', 'rate');
  const summary = {
    load: {
      base_url: baseUrl,
      virtual_users: vus,
      ramp_up: rampUp,
      duration,
      ramp_down: rampDown,
    },
    metrics: {
      response_time_avg_ms: rounded(metricValue(data, 'http_req_duration', 'avg')),
      response_time_p95_ms: rounded(metricValue(data, 'http_req_duration', 'p(95)')),
      error_rate_percent: rounded(checkPassRate === null ? null : (1 - checkPassRate) * 100),
      requests_per_second: rounded(metricValue(data, 'http_reqs', 'rate')),
      total_requests: metricValue(data, 'http_reqs', 'count'),
    },
    endpoint_checks: data.root_group.checks,
  };
  const output = { stdout: `${JSON.stringify(summary, null, 2)}\n` };

  if (__ENV.SUMMARY_FILE) {
    output[__ENV.SUMMARY_FILE] = `${JSON.stringify(summary, null, 2)}\n`;
  }

  return output;
}
