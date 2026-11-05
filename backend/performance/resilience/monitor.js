const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const options = {
  targets: [],
  websocketTargets: [],
  intervalMs: 1000,
  durationSeconds: 0,
  timeoutMs: 3000,
  output: path.join(__dirname, 'results', `resilience-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`),
  token: process.env.TOKEN || '',
};

try {
  parseArgs();
  validateOptions();
} catch (error) {
  console.error(error.message);
  printUsage();
  process.exit(1);
}

const records = [];
const stateByTarget = new Map();
let sequence = 0;
let stopped = false;
let stopReason = '';
let timer;
let activeRound = null;
let finalized = false;
let WebSocket;
const monitorStartedAt = Date.now();

for (const target of [...options.targets, ...options.websocketTargets]) {
  stateByTarget.set(target.name, {
    total: 0,
    successes: 0,
    failures: 0,
    outageStartedAt: null,
    outages: [],
  });
}

fs.mkdirSync(path.dirname(options.output), { recursive: true });

if (options.websocketTargets.length > 0) {
  try {
    WebSocket = require(require.resolve('ws', { paths: [path.resolve(__dirname, '../..')] }));
  } catch (error) {
    console.error(`No se pudo cargar la dependencia existente "ws": ${error.message}`);
    process.exit(1);
  }
}

const csvStream = fs.createWriteStream(options.output, { flags: 'w' });
csvStream.write('sequence,timestamp,target,protocol,success,status,latency_ms,error,outage_id,recovery_ms\n');

console.log(`Monitorizando ${stateByTarget.size} objetivo(s) cada ${options.intervalMs} ms.`);
console.log(`Evidencia CSV: ${path.resolve(options.output)}`);
console.log(options.durationSeconds > 0
  ? `Duración: ${options.durationSeconds} s. Presiona Ctrl+C para terminar antes.`
  : 'Duración indefinida. Presiona Ctrl+C para finalizar y guardar el resumen.');

process.on('SIGINT', () => {
  stop('SIGINT');
});

process.on('SIGTERM', () => {
  stop('SIGTERM');
});

runRound();

function parseArgs() {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = args[index + 1];

    if (arg === '--target' || arg === '--websocket') {
      if (!value) {
        throw new Error(`Falta el valor para ${arg}.`);
      }
      const target = parseTarget(value, arg === '--websocket' ? 'ws' : 'http');
      (arg === '--websocket' ? options.websocketTargets : options.targets).push(target);
      index += 1;
    } else if (arg === '--interval-ms' || arg === '--duration-seconds' || arg === '--timeout-ms' || arg === '--output' || arg === '--token') {
      if (!value) {
        throw new Error(`Falta el valor para ${arg}.`);
      }
      if (arg === '--interval-ms') options.intervalMs = Number(value);
      if (arg === '--duration-seconds') options.durationSeconds = Number(value);
      if (arg === '--timeout-ms') options.timeoutMs = Number(value);
      if (arg === '--output') options.output = path.resolve(value);
      if (arg === '--token') options.token = value;
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Argumento desconocido: ${arg}`);
    }
  }
}

function parseTarget(value, protocol) {
  const separator = value.indexOf('=');
  if (separator <= 0 || separator === value.length - 1) {
    throw new Error(`Objetivo inválido "${value}". Usa nombre=URL.`);
  }

  const name = value.slice(0, separator);
  const url = value.slice(separator + 1);
  const parsedUrl = new URL(url);
  const allowedProtocols = protocol === 'ws' ? ['ws:', 'wss:'] : ['http:', 'https:'];

  if (!allowedProtocols.includes(parsedUrl.protocol)) {
    throw new Error(`Protocolo no válido para ${name}: ${parsedUrl.protocol}.`);
  }

  return { name, url };
}

function validateOptions() {
  if (options.targets.length === 0 && options.websocketTargets.length === 0) {
    throw new Error('Define al menos un --target o --websocket.');
  }
  if (options.intervalMs < 100 || !Number.isFinite(options.intervalMs)) {
    throw new Error('--interval-ms debe ser un número de al menos 100.');
  }
  if (options.durationSeconds < 0 || !Number.isFinite(options.durationSeconds)) {
    throw new Error('--duration-seconds debe ser cero o mayor.');
  }
  if (options.timeoutMs < 1 || !Number.isFinite(options.timeoutMs)) {
    throw new Error('--timeout-ms debe ser mayor que cero.');
  }
  if (path.extname(options.output).toLowerCase() !== '.csv') {
    throw new Error('--output debe tener extensión .csv.');
  }

  const names = [...options.targets, ...options.websocketTargets].map((target) => target.name);
  if (new Set(names).size !== names.length) {
    throw new Error('Cada objetivo debe tener un nombre único.');
  }
}

async function runRound() {
  const startedAt = Date.now();
  const probes = [
    ...options.targets.map((target) => probeHttp(target)),
    ...options.websocketTargets.map((target) => probeWebSocket(target)),
  ];

  activeRound = Promise.all(probes);
  await activeRound;
  activeRound = null;

  if (stopped) {
    finalize(stopReason);
    return;
  }
  if (options.durationSeconds > 0 && Date.now() - monitorStartedAt >= options.durationSeconds * 1000) {
    stop('duration');
    return;
  }

  timer = setTimeout(runRound, Math.max(0, options.intervalMs - (Date.now() - startedAt)));
}

async function probeHttp(target) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const headers = options.token ? { Authorization: `Bearer ${options.token}` } : {};
  let status = '';
  let error = '';

  try {
    const response = await fetch(target.url, { headers, signal: controller.signal });
    status = response.status;
    await response.body?.cancel().catch((cancelError) => {
      console.warn(`No se pudo liberar la respuesta de ${target.name}: ${cancelError.message}`);
    });
    recordProbe(target.name, 'http', response.ok, status, Date.now() - startedAt, error);
  } catch (probeError) {
    error = probeError.name === 'AbortError' ? 'timeout' : probeError.message;
    recordProbe(target.name, 'http', false, status, Date.now() - startedAt, error);
  } finally {
    clearTimeout(timeout);
  }
}

function probeWebSocket(target) {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    let socket;
    try {
      socket = new WebSocket(target.url);
    } catch (error) {
      recordProbe(target.name, 'websocket', false, '', Date.now() - startedAt, error.message);
      resolve();
      return;
    }

    let completed = false;
    const timeout = setTimeout(() => {
      finish(false, 'timeout esperando conexión/mensaje');
    }, options.timeoutMs);

    function finish(success, error = '') {
      if (completed) return;
      completed = true;
      clearTimeout(timeout);
      recordProbe(target.name, 'websocket', success, success ? 101 : '', Date.now() - startedAt, error);
      socket.terminate();
      resolve();
    }

    socket.once('message', (message) => {
      try {
        const payload = JSON.parse(message.toString());
        if (payload.tipo !== 'conexion') {
          finish(false, 'mensaje inicial inesperado');
          return;
        }
        finish(true);
      } catch {
        finish(false, 'mensaje inicial no es JSON válido');
      }
    });

    socket.once('error', (error) => finish(false, error.message));
    socket.once('unexpected-response', (_request, response) => {
      finish(false, `HTTP ${response.statusCode} al negociar WebSocket`);
    });
  });
}

function recordProbe(target, protocol, success, status, latencyMs, error) {
  const timestamp = new Date().toISOString();
  const state = stateByTarget.get(target);
  let outageId = '';
  let recoveryMs = '';

  state.total += 1;
  if (success) {
    state.successes += 1;
    if (state.outageStartedAt !== null) {
      recoveryMs = Date.parse(timestamp) - state.outageStartedAt;
      outageId = state.outages.length;
      state.outages[state.outages.length - 1].recoveryMs = recoveryMs;
      state.outageStartedAt = null;
      console.log(`[${timestamp}] RECUPERADO ${target} en ${recoveryMs} ms`);
    }
  } else {
    state.failures += 1;
    if (state.outageStartedAt === null) {
      state.outageStartedAt = Date.parse(timestamp);
      state.outages.push({ startedAt: timestamp, recoveryMs: null });
      console.log(`[${timestamp}] FALLO ${target}: ${error || `HTTP ${status}`}`);
    }
  }

  if (state.outageStartedAt !== null) {
    outageId = state.outages.length;
  } else if (!success) {
    outageId = state.outages.length;
  }

  const record = {
    sequence: ++sequence,
    timestamp,
    target,
    protocol,
    success,
    status,
    latencyMs,
    error,
    outageId,
    recoveryMs,
  };
  records.push(record);
  csvStream.write([
    record.sequence,
    record.timestamp,
    csv(record.target),
    record.protocol,
    record.success,
    record.status,
    record.latencyMs,
    csv(record.error),
    record.outageId,
    record.recoveryMs,
  ].join(',') + '\n');
}

function stop(reason) {
  if (stopped) return;
  stopped = true;
  stopReason = reason;
  clearTimeout(timer);
  if (!activeRound) finalize(reason);
}

function finalize(reason) {
  if (finalized) return;
  finalized = true;
  csvStream.end(() => {
    const summary = buildSummary(reason);
    const summaryPath = options.output.replace(/\.csv$/i, '.summary.json');
    fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
    console.log(`Resumen JSON: ${summaryPath}`);
    console.log(JSON.stringify(summary.targets, null, 2));
  });
}

function buildSummary(reason) {
  const targets = {};
  for (const [name, state] of stateByTarget) {
    targets[name] = {
      total_probes: state.total,
      successful_probes: state.successes,
      failed_probes: state.failures,
      observed_availability_percent: state.total
        ? Number(((state.successes / state.total) * 100).toFixed(2))
        : null,
      outages: state.outages,
      outage_still_open: state.outageStartedAt !== null,
    };
  }
  return {
    started_at: records.length ? records[0].timestamp : null,
    finished_at: records.length ? records[records.length - 1].timestamp : null,
    stop_reason: reason,
    interval_ms: options.intervalMs,
    timeout_ms: options.timeoutMs,
    targets,
  };
}

function csv(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function printUsage() {
  console.log(`Uso:
  node monitor.js --target nombre=http://host:puerto/api/health [opciones]

Opciones:
  --target nombre=URL          HTTP(S) objetivo; se puede repetir
  --websocket nombre=URL       WS(S), se puede repetir; verifica mensaje inicial conexion
  --token JWT                  Authorization Bearer para todos los objetivos HTTP
  --interval-ms N              Intervalo entre rondas (predeterminado: 1000)
  --duration-seconds N         Duración; 0 significa hasta Ctrl+C (predeterminado: 0)
  --timeout-ms N               Timeout por sondeo (predeterminado: 3000)
  --output archivo.csv         CSV; también genera archivo .summary.json`);
}
