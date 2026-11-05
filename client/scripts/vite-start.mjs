// Detached Vite start that survives the parent shell.
import { spawn } from 'node:child_process';
const child = spawn('cmd.exe', ['/c', 'start', '/b', '', 'npm', 'run', 'dev'], {
  cwd: process.cwd(),
  detached: true,
  stdio: 'ignore',
});
child.unref();
console.log('vite launched');
