const fs = require('node:fs');
const path = require('node:path');

const files = process.argv.slice(2);

if (files.length < 2) {
  console.error('Uso: node compare-results.js <resultado-1.json> <resultado-2.json> [...]');
  process.exit(1);
}

const results = files.map((file) => {
  const resolvedPath = path.resolve(file);
  let summary;

  try {
    summary = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  } catch (error) {
    console.error(`No se pudo leer ${file}: ${error.message}`);
    process.exitCode = 1;
    return null;
  }

  if (!summary.load || !summary.metrics) {
    console.error(`${file} no tiene el formato de resumen esperado de load-test.js.`);
    process.exitCode = 1;
    return null;
  }

  return {
    vus: summary.load.virtual_users,
    average: summary.metrics.response_time_avg_ms,
    p95: summary.metrics.response_time_p95_ms,
    errorRate: summary.metrics.error_rate_percent,
    requestsPerSecond: summary.metrics.requests_per_second,
    totalRequests: summary.metrics.total_requests,
  };
}).filter(Boolean);

if (results.length !== files.length) {
  process.exit(1);
}

const columns = [
  ['VUs', 'vus'],
  ['Media ms', 'average'],
  ['p(95) ms', 'p95'],
  ['Errores %', 'errorRate'],
  ['Solicitudes/s', 'requestsPerSecond'],
  ['Solicitudes', 'totalRequests'],
];
const widths = columns.map(([heading, key]) => Math.max(
  heading.length,
  ...results.map((result) => format(result[key]).length)
));

console.log(columns.map(([heading], index) => heading.padEnd(widths[index])).join(' | '));
console.log(widths.map((width) => '-'.repeat(width)).join('-+-'));
for (const result of results) {
  console.log(columns.map(([, key], index) => format(result[key]).padEnd(widths[index])).join(' | '));
}

function format(value) {
  if (value === null || value === undefined) {
    return 'N/D';
  }
  if (typeof value !== 'number') {
    return String(value);
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
