import { readFileSync } from 'node:fs';

let cached: string | undefined;

/** Package version, resolved from package.json (works from src/ and dist/). */
export function appVersion(): string {
  if (!cached) {
    const manifestUrl = new URL('../../package.json', import.meta.url);
    const manifest = JSON.parse(readFileSync(manifestUrl, 'utf8')) as { version?: string };
    cached = manifest.version ?? '0.0.0';
  }
  return cached;
}
