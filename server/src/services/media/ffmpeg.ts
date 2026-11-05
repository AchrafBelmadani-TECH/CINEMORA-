import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { AppError } from '../../lib/errors.js';
import type { Env } from '../../lib/env.js';

function resolveBinary(envPath: string | undefined, staticPath: string | undefined, name: string): string {
  if (envPath && existsSync(envPath)) return envPath;
  if (staticPath && existsSync(staticPath)) return staticPath;
  throw AppError.internal(
    `${name} binary not found — install ffmpeg-static/ffprobe-static or set the ${name.toUpperCase()}_PATH override`,
  );
}

export interface ProbeResult {
  durationSeconds: number;
  width: number | null;
  height: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  container: string | null;
  bitrate: number | null;
}

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
}

interface FfprobeOutput {
  streams?: FfprobeStream[];
  format?: { duration?: string; format_name?: string; bit_rate?: string };
}

/**
 * FFmpeg/FFprobe wrapper (ADR #18). Binary resolution: env override first,
 * then the ffmpeg-static/ffprobe-static packages installed with the server.
 */
export class FfmpegService {
  private ffmpegPath: string | null = null;
  private ffprobePath: string | null = null;
  private readonly running = new Map<string, () => void>();

  constructor(private readonly env: Env) {}

  /** Binary paths resolve lazily so the API boots even without FFmpeg present. */
  private binary(kind: 'ffmpeg' | 'ffprobe'): string {
    if (kind === 'ffmpeg' && this.ffmpegPath) return this.ffmpegPath;
    if (kind === 'ffprobe' && this.ffprobePath) return this.ffprobePath;
    const require_ = createRequire(import.meta.url);
    let staticPath: string | undefined;
    try {
      if (kind === 'ffmpeg') staticPath = require_('ffmpeg-static') as string;
      else staticPath = (require_('ffprobe-static') as { path: string }).path;
    } catch {
      // fall back to PATH lookup by spawn
    }
    const resolved = resolveBinary(
      this.env[kind === 'ffmpeg' ? 'FFMPEG_PATH' : 'FFPROBE_PATH'],
      staticPath,
      kind,
    );
    if (kind === 'ffmpeg') this.ffmpegPath = resolved;
    else this.ffprobePath = resolved;
    return resolved;
  }

  /** Inspects a media file: duration, resolution, codecs. Rejects non-media. */
  async probe(fileKey: string, storage: { resolvePath(key: string): string }): Promise<ProbeResult> {
    const path = storage.resolvePath(fileKey);
    const output = await this.exec(this.binary('ffprobe'), [
      '-v', 'error',
      '-print_format', 'json',
      '-show_format', '-show_streams',
      path,
    ], 30_000);

    let parsed: FfprobeOutput;
    try {
      parsed = JSON.parse(output) as FfprobeOutput;
    } catch {
      throw AppError.internal('ffprobe returned unparseable output');
    }

    const video = parsed.streams?.find((s) => s.codec_type === 'video');
    const audio = parsed.streams?.find((s) => s.codec_type === 'audio');
    const duration = Number(parsed.format?.duration ?? 0);

    if (!video || duration <= 0) {
      throw AppError.badRequest('The uploaded file is not a playable video');
    }

    return {
      durationSeconds: Math.round(duration),
      width: video.width ?? null,
      height: video.height ?? null,
      videoCodec: video.codec_name ?? null,
      audioCodec: audio?.codec_name ?? null,
      container: parsed.format?.format_name ?? null,
      bitrate: parsed.format?.bit_rate ? Number(parsed.format.bit_rate) : null,
    };
  }

  /**
   * Transcodes a source file to an HLS ladder — one ffmpeg run per variant,
   * then a generated master playlist. Variants are produced only when the
   * source resolution supports them, so availability is never overstated.
   * Progress is reported as seconds processed; cancellable mid-run.
   * Originals are never modified (source is read-only input).
   */
  transcodeToHls(
    assetId: string,
    sourceKey: string,
    hlsDirKey: string,
    storage: { resolvePath(key: string): string; ensureDir(key: string): Promise<void> },
    durationSeconds: number,
    onProgress: (seconds: number) => void,
    onDone: (err: Error | null) => void,
  ): { cancel: () => void } {
    const run = async () => {
      const sourcePath = storage.resolvePath(sourceKey);
      const outDir = storage.resolvePath(`${hlsDirKey}/`);
      const probe = await this.probe(sourceKey, storage).catch(() => null);
      const sourceHeight = probe?.height ?? 0;

      const ladder = [720, 480].filter((h) => sourceHeight >= h);
      if (ladder.length === 0) ladder.push(480); // tiny sources still get one legible variant

      for (const height of ladder) {
        await storage.ensureDir(`${hlsDirKey}/${height}p/playlist.m3u8`);
        await this.runVariant(assetId, sourcePath, outDir, height, durationSeconds, probe?.audioCodec != null, onProgress);
      }

      const master: string[] = ['#EXTM3U', '#EXT-X-VERSION:3'];
      for (const height of ladder) {
        const bandwidth = height === 720 ? 2800000 : 1200000;
        const width = probe?.width && probe?.height ? Math.round((probe.width / probe.height) * height) : null;
        master.push(
          `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${width ?? ''}x${height},NAME="${height}p"`,
          `${height}p/playlist.m3u8`,
        );
      }
      await writeFile(storage.resolvePath(`${hlsDirKey}/master.m3u8`), master.join('\n') + '\n');
    };

    run().then(() => onDone(null), (err: Error) => onDone(err));
    return {
      cancel: () => {
        for (const cancel of this.running.values()) cancel();
      },
    };
  }

  private runVariant(
    assetId: string,
    sourcePath: string,
    outDir: string,
    height: number,
    durationSeconds: number,
    hasAudio: boolean,
    onProgress: (seconds: number) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '-y', '-i', sourcePath,
        '-vf', `scale=-2:${height}`,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
        '-maxrate', height === 720 ? '2800k' : '1200k',
        '-bufsize', height === 720 ? '5600k' : '2400k',
        ...(hasAudio ? ['-c:a', 'aac', '-b:a', '128k'] : ['-an']),
        '-hls_time', '6',
        '-hls_playlist_type', 'vod',
        '-hls_segment_type', 'mpegts',
        '-hls_segment_filename', `${outDir}${height}p/segment_%05d.ts`,
        `${outDir}${height}p/playlist.m3u8`,
      ];
      const proc = spawn(this.binary('ffmpeg'), args, { windowsHide: true });
      const cancelKey = `${assetId}:${height}`;
      this.running.set(cancelKey, () => proc.kill('SIGKILL'));

      let stderrTail = '';
      proc.stderr?.on('data', (chunk: Buffer) => {
        stderrTail = (stderrTail + chunk.toString()).slice(-2000);
        const match = /time=(\d+):(\d+):(\d+\.\d+)/.exec(chunk.toString());
        if (match && durationSeconds > 0) {
          const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
          onProgress(Math.min(seconds, durationSeconds));
        }
      });
      proc.on('error', (err) => {
        this.running.delete(cancelKey);
        reject(err);
      });
      proc.on('close', (code) => {
        this.running.delete(cancelKey);
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}: ${stderrTail.slice(-400)}`));
      });
    });
  }

  private async exec(binary: string, args: string[], timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(binary, args, { windowsHide: true });
      let out = '';
      let stderr = '';
      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error(`${binary} timed out`));
      }, timeoutMs);
      proc.stdout?.on('data', (c: Buffer) => (out += c.toString()));
      proc.stderr?.on('data', (c: Buffer) => (stderr += c.toString()));
      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(out);
        else reject(new Error(`${binary} exited ${code}: ${stderr.slice(-300)}`));
      });
    });
  }
}
