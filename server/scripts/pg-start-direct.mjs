// Detached postgres start that survives the parent shell (uses cmd start /b).
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { connect } from 'node:net';

const serverDir = resolve(process.cwd());
const bin = join(serverDir, '..', 'node_modules', '@embedded-postgres', 'windows-x64', 'native', 'bin', 'pg_ctl.exe');
const dataDir = join(serverDir, '.pgdata');

function isReady() {
  return new Promise((r) => {
    const s = connect({ host: '127.0.0.1', port: 5433, timeout: 1500 });
    s.on('connect', () => { s.destroy(); r(true); });
    s.on('error', () => r(false));
    s.on('timeout', () => { s.destroy(); r(false); });
  });
}

if (await isReady()) {
  console.log('postgres: already up');
  process.exit(0);
}
if (!existsSync(join(dataDir, 'PG_VERSION'))) {
  console.error('data dir missing — run initdb first');
  process.exit(1);
}

const child = spawn('cmd.exe', ['/c', 'start', '/b', '', bin, '-D', dataDir, '-l', join(dataDir, 'server.log'), '-o', '-p 5433', 'start'], {
  detached: true,
  stdio: 'ignore',
  windowsVerbatimArguments: false,
});
child.unref();

let waited = 0;
while (!(await isReady())) {
  await new Promise((r) => setTimeout(r, 500));
  waited += 500;
  if (waited > 30000) {
    console.error('postgres did not become ready in 30s');
    process.exit(1);
  }
}
console.log('postgres: up on :5433');
