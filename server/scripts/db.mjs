/**
 * CINEMORA local database lifecycle (Windows-first, cross-platform paths).
 *
 * Drives the PostgreSQL binaries shipped by `embedded-postgres` directly with
 * initdb/pg_ctl, so the daemon survives the npm script that started it.
 * Dev-only trust auth on 127.0.0.1:5433 — production uses DATABASE_URL against
 * a managed Postgres and never runs this script.
 */
import { spawnSync } from 'node:child_process';
import { connect } from 'node:net';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const serverDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(join(serverDir, 'package.json'));

function binaryDir() {
  const candidates = [
    join(serverDir, 'node_modules', '@embedded-postgres', 'windows-x64', 'native', 'bin'),
    join(serverDir, '..', 'node_modules', '@embedded-postgres', 'windows-x64', 'native', 'bin'),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  console.error('embedded-postgres binaries not found — run npm install first');
  process.exit(1);
}

const BIN = binaryDir();
const DATA_DIR = join(serverDir, '.pgdata');
const PORT = 5433;
const USER = 'cinemora';
const DB = 'cinemora';

function run(name, args, opts = {}) {
  const result = spawnSync(join(BIN, `${name}.exe`), args, {
    stdio: opts.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    env: { ...process.env, PGPASSWORD: '' },
  });
  if (opts.capture) return { status: result.status, out: `${result.stdout ?? ''}${result.stderr ?? ''}` };
  return { status: result.status, out: '' };
}

/** pg_isready.exe fails to spawn in some Windows environments — probe the TCP port instead. */
function isReady() {
  return new Promise((resolveProbe) => {
    const socket = connect({ host: '127.0.0.1', port: PORT, timeout: 1500 });
    socket.on('connect', () => {
      socket.destroy();
      resolveProbe(true);
    });
    socket.on('error', () => resolveProbe(false));
    socket.on('timeout', () => {
      socket.destroy();
      resolveProbe(false);
    });
  });
}

async function waitForReady(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isReady()) return true;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
  }
  return false;
}

function databaseExists() {
  const { out } = run('psql', ['-U', USER, '-p', String(PORT), '-d', 'postgres', '-tAc', `SELECT 1 FROM pg_database WHERE datname='${DB}'`], { capture: true });
  return out.trim() === '1';
}

async function start() {
  if (await isReady()) {
    console.log(`postgres already accepting connections on :${PORT}`);
    await ensureDatabase();
    return;
  }

  if (!existsSync(join(DATA_DIR, 'PG_VERSION'))) {
    console.log('initialising data directory (first run)…');
    const init = run('initdb', ['-D', DATA_DIR, '-U', USER, '-E', 'UTF8', '-A', 'trust']);
    if (init.status !== 0) process.exit(1);
  }

  console.log(`starting postgres on :${PORT}…`);
  const started = run('pg_ctl', ['-D', DATA_DIR, '-l', join(DATA_DIR, 'server.log'), '-o', `-p ${PORT}`, 'start']);
  if (started.status !== 0 || !(await waitForReady())) {
    console.error('postgres failed to start — see server/.pgdata/server.log');
    process.exit(1);
  }
  await ensureDatabase();
  console.log(`postgres ready: postgresql://${USER}@localhost:${PORT}/${DB}`);
}

async function ensureDatabase() {
  if (await databaseExists()) return;
  console.log(`creating database "${DB}"…`);
  run('createdb', ['-U', USER, '-p', String(PORT), DB]);
}

function stop() {
  if (!existsSync(join(DATA_DIR, 'PG_VERSION'))) {
    console.log('no data directory — nothing to stop');
    return;
  }
  const result = run('pg_ctl', ['-D', DATA_DIR, '-m', 'fast', 'stop']);
  console.log(result.status === 0 ? 'postgres stopped' : 'postgres was not running');
}

async function status() {
  console.log((await isReady()) ? `postgres: up on :${PORT}` : 'postgres: down');
}

async function reset() {
  stop();
  if (existsSync(DATA_DIR)) {
    rmSync(DATA_DIR, { recursive: true, force: true });
    console.log('data directory removed');
  }
  console.log('run `npm run db:start` and `npx prisma migrate dev` to recreate');
}

const command = process.argv[2];
const commands = { start, stop, status, reset };
if (!commands[command]) {
  console.error('usage: node scripts/db.mjs <start|stop|status|reset>');
  process.exit(1);
}
await commands[command]();
