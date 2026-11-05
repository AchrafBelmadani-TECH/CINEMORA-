import { Router } from 'express';
import type { Request, Response, RequestHandler, NextFunction } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Env } from '../lib/env.js';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireProfile, requireRole } from '../middleware/auth.js';
import { verifyMediaToken } from '../services/media/mediaToken.js';
import { safeJoin, type MediaStorage } from '../services/media/storage.js';
import type { TranscodeService } from '../services/media/transcode.service.js';
import type { PlaybackService } from '../services/media/playback.service.js';
import { srtToVtt, isSrt, looksLikeVtt } from '../services/media/subtitles.js';

const MEDIA_MIME: Record<string, string> = {
  '.m3u8': 'application/vnd.apple-mpegurl',
  '.ts': 'video/mp2t',
  '.vtt': 'text/vtt',
};

const VIDEO_EXT = /\.(mp4|mkv|webm|mov)$/i;
const MAX_VIDEO_BYTES = 8 * 1024 * 1024 * 1024; // 8 GB
const MAX_SUBTITLE_BYTES = 1024 * 1024; // 1 MB

const streamInfoParams = z.object({
  tmdbType: z.enum(['movie', 'tv']),
  tmdbId: z.coerce.number().int().min(1),
});

const progressSchema = z.object({
  videoAssetId: z.string().uuid(),
  positionSeconds: z.coerce.number().int().min(0).max(86_400 * 4),
  durationSeconds: z.coerce.number().int().min(0).max(86_400 * 4),
});

const licenseSchema = z.object({
  licenseType: z.enum(['PUBLIC_DOMAIN', 'CREATIVE_COMMONS', 'LICENSED', 'USER_UPLOAD']),
  licenseRef: z.string().trim().min(4, 'A license reference URL or document id is required'),
  titleId: z.string().uuid().optional(),
  episodeId: z.string().uuid().optional(),
});

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

/**
 * Playback, progress and secure media delivery. Every playback URL carries a
 * short-lived HMAC token; the token is verified before any file is touched.
 */
export function mediaRoutes(services: {
  env: Env;
  storage: MediaStorage;
  transcode: TranscodeService;
  playback: PlaybackService;
}): Router {
  const router = Router();
  const { env, storage, transcode, playback } = services;

  // ── Session-required APIs ────────────────────────────────────────────────
  const session = Router();

  session.get(
    '/titles/:tmdbType/:tmdbId/stream-info',
    requireAuth(env),
    asyncRoute(async (req, res) => {
      const { tmdbType, tmdbId } = streamInfoParams.parse(req.params);
      const episodeId = typeof req.query.episodeId === 'string' && z.string().uuid().safeParse(req.query.episodeId).success
        ? (req.query.episodeId as string)
        : undefined;
      res.json(
        await playback.titleStreamInfo(tmdbType, tmdbId, req.auth!.userId, req.auth!.profileId, episodeId),
      );
    }),
  );

  session.get(
    '/titles/:tmdbType/:tmdbId/episode-availability',
    requireAuth(env),
    asyncRoute(async (req, res) => {
      const { tmdbType, tmdbId } = streamInfoParams.parse(req.params);
      res.json(await playback.episodeAvailability(tmdbType, tmdbId));
    }),
  );

  session.get(
    '/playback/continue-watching',
    requireAuth(env),
    requireProfile(),
    requireAuth(env),
    asyncRoute(async (req, res) => {
      res.json(await playback.continueWatching(req.auth!.profileId!));
    }),
  );

  session.get(
    '/playback/progress/:videoAssetId',
    requireAuth(env),
    requireProfile(),
    requireAuth(env),
    asyncRoute(async (req, res) => {
      const { videoAssetId } = z.object({ videoAssetId: z.string().uuid() }).parse(req.params);
      const progress = await prisma.playbackProgress.findUnique({
        where: { profileId_videoAssetId: { profileId: req.auth!.profileId!, videoAssetId } },
      });
      res.json({ progress });
    }),
  );

  session.post(
    '/playback/progress',
    requireAuth(env),
    requireProfile(),
    requireAuth(env),
    asyncRoute(async (req, res) => {
      const body = progressSchema.parse(req.body);

      // The asset must exist AND belong to a published title (no orphan writes).
      const asset = await prisma.videoAsset.findUnique({
        where: { id: body.videoAssetId },
        select: { id: true, title: { select: { isPublished: true } } },
      });
      if (!asset) throw AppError.notFound('Video asset not found');
      if (asset.title && !asset.title.isPublished) throw AppError.forbidden('This title is not published');

      const completed = body.durationSeconds > 0 && body.positionSeconds >= body.durationSeconds * 0.95;
      const progress = await prisma.playbackProgress.upsert({
        where: { profileId_videoAssetId: { profileId: req.auth!.profileId!, videoAssetId: body.videoAssetId } },
        create: {
          userId: req.auth!.userId,
          profileId: req.auth!.profileId!,
          videoAssetId: body.videoAssetId,
          positionSeconds: body.positionSeconds,
          durationSeconds: body.durationSeconds,
          completed,
        },
        update: {
          positionSeconds: body.positionSeconds,
          durationSeconds: body.durationSeconds,
          completed,
        },
      });
      res.json({ progress });
    }),
  );

  // ── Secure media delivery (HMAC token in query; no session required) ────
  router.get(
    '/media/hls/:assetId/:file',
    requireAuth(env),
    asyncRoute(async (req, res) => {
      const { assetId } = z.object({ assetId: z.string().uuid() }).parse(req.params);
      const file = req.params.file as string;
      const token = typeof req.query.token === 'string' ? req.query.token : '';

      if (!verifyMediaToken(assetId, token, env.JWT_SECRET)) {
        throw AppError.forbidden('Invalid or expired media token');
      }

      // Whitelist: master + per-variant playlists + mpegts segments only.
      if (!/^(master\.m3u8|\d+p\/playlist\.m3u8|\d+p\/segment_\d{5}\.ts)$/.test(file)) {
        throw AppError.badRequest('Invalid media file');
      }

      const asset = await prisma.videoAsset.findUnique({
        where: { id: assetId },
        select: { status: true, hlsPrefix: true, title: { select: { isPublished: true } } },
      });
      if (!asset || asset.status !== 'READY' || !asset.hlsPrefix) {
        throw AppError.notFound('Media asset is not ready');
      }
      if (asset.title && !asset.title.isPublished) {
        throw AppError.forbidden('This title is not published');
      }

      const key = `${asset.hlsPrefix}/${file}`;
      if (!storage.exists(key)) throw AppError.notFound('Media file not found');

      const ext = file.slice(file.lastIndexOf('.')) || '';
      res.setHeader('content-type', MEDIA_MIME[ext] ?? 'application/octet-stream');
      res.setHeader('cache-control', 'private, max-age=3600');
      // Playlists/segments are read whole; no Range needed for MPEG-TS chunks.
      storage.readStream(key).pipe(res);
    }),
  );

  router.get(
    '/media/subtitles/:trackId.vtt',
    requireAuth(env),
    asyncRoute(async (req, res) => {
      const { trackId } = z.object({ trackId: z.string().uuid() }).parse(req.params);
      const token = typeof req.query.token === 'string' ? req.query.token : '';
      if (!verifyMediaToken(trackId, token, env.JWT_SECRET)) {
        throw AppError.forbidden('Invalid or expired media token');
      }

      const track = await prisma.subtitleTrack.findUnique({
        where: { id: trackId },
        select: { storageKey: true },
      });
      if (!track) throw AppError.notFound('Subtitle track not found');

      res.setHeader('content-type', MEDIA_MIME['.vtt'] ?? 'text/vtt');
      storage.readStream(track.storageKey).pipe(res);
    }),
  );

  // ── Admin: uploads, retries, monitoring (RBAC from Phase 5) ─────────────
  const admin = Router();
  admin.use(requireAuth(env));
  admin.use(requireRole('ADMIN'));

  const videoUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        try {
          const dir = safeJoin(storage.resolvePath('originals'), '_incoming');
          cb(null, dir);
        } catch (err) {
          cb(err as Error, '');
        }
      },
      filename: (_req, file, cb) => cb(null, `${randomUUID()}${file.originalname.match(VIDEO_EXT)?.[0] ?? '.mp4'}`),
    }),
    limits: { fileSize: MAX_VIDEO_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (!VIDEO_EXT.test(file.originalname)) {
        cb(new AppError('VALIDATION_ERROR', 400, 'Only .mp4, .mkv, .webm, .mov files are accepted'));
        return;
      }
      cb(null, true);
    },
  });

  admin.post(
    '/media/video',
    videoUpload.single('file'),
    requireAuth(env),
    asyncRoute(async (req, res) => {
      if (!req.file) throw AppError.badRequest('A video file is required');
      const license = licenseSchema.parse({
        ...(req.body as Record<string, string>),
      });
      if (!license.titleId && !license.episodeId) {
        throw AppError.badRequest('Attach the asset to a titleId or an episodeId');
      }
      if (license.titleId && license.episodeId) {
        throw AppError.badRequest('Attach the asset to a title OR an episode, not both');
      }

      // Validate the association exists.
      if (license.titleId) {
        const title = await prisma.title.findUnique({ where: { id: license.titleId } });
        if (!title) throw AppError.notFound('Title not found');
      } else if (license.episodeId) {
        const episode = await prisma.episode.findUnique({ where: { id: license.episodeId } });
        if (!episode) throw AppError.notFound('Episode not found');
      }

      const ext = req.file.originalname.match(VIDEO_EXT)?.[0] ?? '.mp4';
      const asset = await prisma.videoAsset.create({
        data: {
          titleId: license.titleId ?? null,
          episodeId: license.episodeId ?? null,
          status: 'PENDING',
          licenseType: license.licenseType,
          licenseRef: license.licenseRef,
          sourceKey: `pending/${req.file.filename}`,
        },
      });

      // Move the upload into its per-asset original slot (originals are never
      // modified afterwards).
      const finalKey = `originals/${asset.id}/source${ext}`;
      await storage.ensureDir(finalKey);
      const { renameSync } = await import('node:fs');
      renameSync(req.file.path, storage.resolvePath(finalKey));
      await prisma.videoAsset.update({
        where: { id: asset.id },
        data: { sourceKey: finalKey },
      });

      transcode.enqueue(asset.id);
      res.status(202).json({ videoAsset: { id: asset.id, status: 'PENDING' } });
    }),
  );

  admin.post(
    '/media/video/:id/retry',
    requireAuth(env),
    asyncRoute(async (req, res) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      const asset = await prisma.videoAsset.findUnique({ where: { id } });
      if (!asset) throw AppError.notFound('Video asset not found');
      if (asset.status === 'READY') throw AppError.badRequest('Asset is already ready');
      if (!asset.sourceKey) throw AppError.badRequest('Asset has no source file');

      await prisma.videoAsset.update({ where: { id }, data: { status: 'PENDING' } });
      transcode.enqueue(id);
      res.status(202).json({ videoAsset: { id, status: 'PENDING' } });
    }),
  );

  admin.post(
    '/media/video/:id/cancel',
    requireAuth(env),
    asyncRoute(async (req, res) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      transcode.cancel(id);
      await prisma.videoAsset.update({
        where: { id },
        data: { status: 'FAILED', failureReason: 'Cancelled by administrator' },
      });
      res.json({ videoAsset: { id, status: 'FAILED' } });
    }),
  );

  admin.get(
    '/media/video',
    requireAuth(env),
    asyncRoute(async (req, res) => {
      const status = typeof req.query.status === 'string' && ['PENDING', 'VALIDATING', 'TRANSCODING', 'READY', 'FAILED'].includes(req.query.status)
        ? (req.query.status as 'PENDING' | 'VALIDATING' | 'TRANSCODING' | 'READY' | 'FAILED')
        : undefined;
      const assets = await prisma.videoAsset.findMany({
        where: status ? { status } : undefined,
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true, status: true, failureReason: true, qualities: true,
          durationSeconds: true, licenseType: true, createdAt: true,
          title: { select: { title: true } },
          episode: { select: { name: true, season: { select: { seasonNumber: true } } } },
        },
      });
      res.json({ assets });
    }),
  );

  const subtitleUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_SUBTITLE_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (!/\.(srt|vtt)$/i.test(file.originalname)) {
        cb(new AppError('VALIDATION_ERROR', 400, 'Only .srt and .vtt files are accepted'));
        return;
      }
      cb(null, true);
    },
  });

  admin.post(
    '/media/subtitles',
    subtitleUpload.single('file'),
    requireAuth(env),
    asyncRoute(async (req, res) => {
      if (!req.file) throw AppError.badRequest('A subtitle file is required');
      const body = z
        .object({
          videoAssetId: z.string().uuid(),
          language: z.string().trim().regex(/^[a-z]{2}$/),
          label: z.string().trim().min(1).max(50),
          isDefault: z.coerce.boolean().default(false),
        })
        .parse(req.body);

      const asset = await prisma.videoAsset.findUnique({ where: { id: body.videoAssetId } });
      if (!asset) throw AppError.notFound('Video asset not found');

      const content = req.file.buffer.toString('utf8');
      let vtt: string;
      let format: 'vtt' | 'srt';
      if (looksLikeVtt(content)) {
        vtt = content;
        format = 'vtt';
      } else if (isSrt(content)) {
        vtt = srtToVtt(content);
        format = 'srt';
      } else {
        throw AppError.badRequest('File is neither SRT nor WebVTT');
      }

      // Original SRT is preserved alongside the converted VTT.
      const srtKey = `subtitles/${asset.id}/${body.language}.original.${format}`;
      const vttKey = `subtitles/${asset.id}/${body.language}.vtt`;
      const { writeFile } = await import('node:fs/promises');
      if (format === 'srt') {
        await storage.ensureDir(srtKey);
        await writeFile(storage.resolvePath(srtKey), content);
      }
      await storage.ensureDir(vttKey);
      await writeFile(storage.resolvePath(vttKey), vtt);

      const track = await prisma.subtitleTrack.upsert({
        where: { videoAssetId_language: { videoAssetId: asset.id, language: body.language } },
        create: {
          videoAssetId: asset.id,
          language: body.language,
          label: body.label,
          format: 'vtt',
          storageKey: vttKey,
          isDefault: body.isDefault,
        },
        update: { label: body.label, storageKey: vttKey, isDefault: body.isDefault },
      });

      res.status(201).json({ subtitleTrack: { id: track.id, language: track.language, label: track.label } });
    }),
  );

  router.use('/admin/media', admin);
  router.use(session);
  return router;
}
