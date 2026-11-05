import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { readdir, rm, stat, mkdir } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import { AppError } from '../../lib/errors.js';
import type { Env } from '../../lib/env.js';

/**
 * Media storage abstraction (ADR #20): files live on disk or object storage —
 * never inside PostgreSQL. LocalStorage backs development; the same interface
 * is implementable against S3/CDN in production.
 */
export interface MediaStorage {
  /** Absolute filesystem path of a storage key (local driver only). */
  resolvePath(key: string): string;
  exists(key: string): boolean;
  /** File size in bytes. */
  size(key: string): number;
  /** Read stream for serving, with optional byte range. */
  readStream(key: string, range?: { start: number; end: number }): ReturnType<typeof createReadStream>;
  /** Ensures the directory for the key exists. */
  ensureDir(key: string): Promise<void>;
  /** Lists direct children keys under a directory-style key prefix. */
  list(prefix: string): Promise<string[]>;
  delete(key: string): Promise<void>;
  /** Health check: root exists and is writable. */
  healthy(): Promise<boolean>;
}

/** Keys are slash-separated, relative to the storage root; traversal is rejected. */
export function safeJoin(root: string, key: string): string {
  const normalized = key.replace(/\\/g, '/').replace(/^\/+/, '');
  const full = resolve(root, normalized);
  const rootWithSep = resolve(root) + sep;
  if (!full.startsWith(rootWithSep)) {
    throw AppError.badRequest('Invalid storage key');
  }
  return full;
}

export class LocalMediaStorage implements MediaStorage {
  readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  resolvePath(key: string): string {
    return safeJoin(this.root, key);
  }

  exists(key: string): boolean {
    return existsSync(this.resolvePath(key));
  }

  size(key: string): number {
    return statSync(this.resolvePath(key)).size;
  }

  readStream(key: string, range?: { start: number; end: number }) {
    const path = this.resolvePath(key);
    return createReadStream(path, range ? { start: range.start, end: range.end } : undefined);
  }

  async ensureDir(key: string): Promise<void> {
    const dir = dirnameKey(this.resolvePath(key));
    await mkdir(dir, { recursive: true });
  }

  async list(prefix: string): Promise<string[]> {
    const dir = this.resolvePath(prefix);
    if (!existsSync(dir)) return [];
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.map((e) => `${prefix.replace(/\/$/, '')}/${e.name}`);
  }

  async delete(key: string): Promise<void> {
    const path = this.resolvePath(key);
    await rm(path, { recursive: true, force: true });
  }

  async healthy(): Promise<boolean> {
    try {
      const probe = join(this.root, '.healthcheck');
      await mkdir(this.root, { recursive: true });
      const { writeFile, unlink } = await import('node:fs/promises');
      await writeFile(probe, 'ok');
      await unlink(probe);
      return true;
    } catch {
      return false;
    }
  }
}

function dirnameKey(path: string): string {
  const idx = path.lastIndexOf(sep);
  return idx === -1 ? path : path.slice(0, idx);
}

/** Builds the storage driver from env (local dev; S3 driver lands in Phase 8). */
export function createMediaStorage(env: Env): MediaStorage {
  if (env.STORAGE_DRIVER !== 'local') {
    throw AppError.internal(`Storage driver "${env.STORAGE_DRIVER}" is not available yet — use STORAGE_DRIVER=local`);
  }
  const root = resolve(env.STORAGE_ROOT);
  mkdirSync(root, { recursive: true });
  return new LocalMediaStorage(root);
}

/** Canonical storage keys (never exposed raw to clients). */
export const storageKeys = {
  original: (assetId: string, ext: string) => `originals/${assetId}/source.${basename(ext).replace(/^\./, '')}`,
  hlsDir: (assetId: string) => `hls/${assetId}`,
  subtitle: (assetId: string, lang: string, format: string) => `subtitles/${assetId}/${lang}.${format}`,
};

export { join, stat, basename };
