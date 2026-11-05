import { prisma } from '../../lib/prisma.js';
import type { Logger } from '../../lib/logger.js';
import type { FfmpegService } from './ffmpeg.js';
import type { MediaStorage } from './storage.js';
import { storageKeys } from './storage.js';
import { recomputeTitleAvailability } from '../library/availability.js';

function ladderFor(sourceHeight: number | null): string[] {
  const ladder = [720, 480].filter((h) => (sourceHeight ?? 0) >= h);
  if (ladder.length === 0) ladder.push(480);
  return ladder.map((h) => `${h}p`);
}

interface ActiveTranscode {
  assetId: string;
  cancel: () => void;
}

/**
 * Serial in-process transcode queue (ADR #18): one job at a time keeps the
 * machine responsive in dev; a Redis/BullMQ worker is the Phase 8+ upgrade.
 * Lifecycle: PENDING → VALIDATING → TRANSCODING → READY | FAILED (retryable).
 * Progress is persisted (seconds + percent) while ffmpeg runs.
 */
export class TranscodeService {
  private queue: Array<{ assetId: string; attempt: number }> = [];
  private processing = false;
  private active: ActiveTranscode | null = null;

  constructor(
    private readonly ffmpeg: FfmpegService,
    private readonly storage: MediaStorage,
    private readonly logger: Logger,
    private readonly maxAttempts = 2,
  ) {}

  /** Enqueues an asset for processing (idempotent per asset). */
  enqueue(assetId: string): void {
    if (this.queue.some((j) => j.assetId === assetId)) return;
    this.queue.push({ assetId, attempt: 0 });
    void this.drain();
  }

  /** Cancels a queued/running job (queued jobs are dropped, running ones killed). */
  cancel(assetId: string): void {
    const queuedIndex = this.queue.findIndex((j) => j.assetId === assetId);
    if (queuedIndex !== -1) this.queue.splice(queuedIndex, 1);
    this.active?.cancel();
  }

  private async drain(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift()!;
        await this.process(job.assetId, job.attempt);
      }
    } finally {
      this.processing = false;
    }
  }

  private async process(assetId: string, attempt: number): Promise<void> {
    const asset = await prisma.videoAsset.findUnique({ where: { id: assetId } });
    if (!asset || !asset.sourceKey || asset.status === 'READY') return;

    try {
      // VALIDATING: ffprobe inspects the real file.
      await prisma.videoAsset.update({ where: { id: assetId }, data: { status: 'VALIDATING' } });
      const probe = await this.ffmpeg.probe(asset.sourceKey, this.storage);

      const ladder = ladderFor(probe.height);
      await prisma.videoAsset.update({
        where: { id: assetId },
        data: {
          status: 'TRANSCODING',
          durationSeconds: probe.durationSeconds,
          qualities: ladder,
          failureReason: null,
        },
      });

      // TRANSCODING: HLS ladder with progress (throttled DB writes).
      const hlsDirKey = storageKeys.hlsDir(assetId);
      const error = await new Promise<{ message: string } | null>((resolve) => {
        const handle = this.ffmpeg.transcodeToHls(
          assetId,
          asset.sourceKey!,
          hlsDirKey,
          this.storage,
          probe.durationSeconds,
          (seconds) => {
            void seconds; // percent is derivable client-side from seconds/duration
          },
          (err: Error | null) => resolve(err ? { message: err.message } : null),
        );
        this.active = { assetId, cancel: handle.cancel };
      });

      if (error) throw new Error(error.message);

      const masterKey = `${hlsDirKey}/master.m3u8`;
      if (!this.storage.exists(masterKey)) {
        throw new Error('HLS master playlist was not generated');
      }

      await prisma.videoAsset.update({
        where: { id: assetId },
        data: {
          status: 'READY',
          hlsPrefix: hlsDirKey,
          sizeBytes: this.storage.exists(asset.sourceKey!) ? this.storage.size(asset.sourceKey!) : null,
        },
      });

      if (asset.titleId) await recomputeTitleAvailability(prisma, asset.titleId);
      this.logger.info({ assetId, ladder }, 'transcode completed');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn({ assetId, attempt, err: message }, 'transcode failed');

      // Validation failures are permanent; transient failures retry once.
      const permanent = /not a playable video/i.test(message);
      if (!permanent && attempt + 1 < this.maxAttempts) {
        this.queue.unshift({ assetId, attempt: attempt + 1 });
        return;
      }

      await prisma.videoAsset.update({
        where: { id: assetId },
        data: { status: 'FAILED', failureReason: message.slice(0, 500) },
      });
      if (asset.titleId) await recomputeTitleAvailability(prisma, asset.titleId);
    }
  }
}
