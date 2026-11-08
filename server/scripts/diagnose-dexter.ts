import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';

(async () => {
  // 1. Dexter title state
  const dexter = await prisma.title.findUnique({
    where: { tmdbType_tmdbId: { tmdbType: 'TV', tmdbId: 1405 } },
    select: {
      id: true, title: true, isPublished: true, availability: true,
      seasons: { select: { seasonNumber: true, _count: { select: { episodes: true } } } },
      _count: { select: { videoSources: true, videoAssets: true } },
    },
  });
  console.log('DEXTER:', JSON.stringify({
    id: dexter?.id?.slice(0, 8), published: dexter?.isPublished,
    availability: dexter?.availability,
    seasons: dexter?.seasons.map((s) => `S${s.seasonNumber}(${s._count.episodes})`),
    sources: dexter?._count.videoSources, assets: dexter?._count.videoAssets,
  }));

  // 2. Episode 1 Season 1: does it exist? has assets/sources?
  const ep1 = await prisma.episode.findFirst({
    where: { season: { titleId: dexter!.id, seasonNumber: 1 }, episodeNumber: 1 },
    select: {
      id: true, name: true,
      _count: { select: { videoAssets: true } },
    },
  });
  console.log('DEXTER S1E1:', JSON.stringify({ id: ep1?.id?.slice(0, 8), name: ep1?.name, assets: ep1?._count.videoAssets }));

  // 3. Simulate titleStreamInfo lookup for episodeNumber=1
  const baseWhere = { episode: { episodeNumber: 1, season: { titleId: dexter!.id } } };
  const ready = await prisma.videoAsset.findFirst({ where: { ...baseWhere, status: 'READY' } });
  const processing = await prisma.videoAsset.findFirst({ where: { ...baseWhere, status: { in: ['VALIDATING', 'TRANSCODING'] } } });
  const remote = await prisma.videoSource.findFirst({ where: { ...baseWhere, status: 'ACTIVE' } });
  console.log('DEXTER S1E1 LOOKUP:', { readyAsset: Boolean(ready), processing: Boolean(processing), remoteSource: Boolean(remote) });

  // 4. One Step Beyond (has real episode sources) — same lookup for its episode
  const osb = await prisma.title.findUnique({
    where: { tmdbType_tmdbId: { tmdbType: 'TV', tmdbId: 10377 } },
    select: { id: true, title: true, isPublished: true },
  });
  const osbEp = await prisma.episode.findFirst({
    where: { season: { titleId: osb!.id, seasonNumber: 3 }, episodeNumber: 11 },
    select: { id: true, name: true, videoSources: { select: { externalUrl: true, status: true } } },
  });
  console.log('OSB S3E11:', JSON.stringify({ name: osbEp?.name, sources: osbEp?.videoSources.map((s) => s.status) }));

  const osbBaseWhere = { episode: { episodeNumber: 11, season: { titleId: osb!.id } } };
  const osbReady = await prisma.videoAsset.findFirst({ where: { ...osbBaseWhere, status: 'READY' } });
  const osbRemote = await prisma.videoSource.findFirst({ where: { ...osbBaseWhere, status: 'ACTIVE' } });
  console.log('OSB S3E11 LOOKUP:', { readyAsset: Boolean(osbReady), remoteSource: Boolean(osbRemote), url: osbRemote?.externalUrl?.slice(0, 60) });

  await prisma.$disconnect();
})();
