import type { AvailabilityStatus, Prisma } from '@prisma/client';
export interface SourceLike {
  status: string;
  expiresAt: Date | null;
}

export interface AssetLike {
  status: string;
}

/**
 * Availability truth (docs/CATALOG_AND_STREAMING_PLAN.md §3): derived ONLY
 * from video sources/assets — never from TMDB metadata. RESTRICTED is never
 * persisted; it is decided per request against the caller's territory.
 */
export function deriveAvailability(
  sources: SourceLike[],
  assets: AssetLike[],
  now: Date = new Date(),
): AvailabilityStatus {
  const hasActiveSource = sources.some((s) => {
    if (s.status === 'EXPIRED') return false;
    if (s.status === 'ACTIVE' && s.expiresAt && s.expiresAt <= now) return false;
    return s.status === 'ACTIVE';
  });
  if (hasActiveSource) return 'AVAILABLE';

  if (assets.some((a) => a.status === 'TRANSCODING' || a.status === 'VALIDATING' || a.status === 'PENDING')) {
    return 'PROCESSING';
  }
  // An expired source means the title WAS watchable once — surface EXPIRED
  // only when no other source covers it.
  const hadSource = sources.length > 0;
  if (hadSource) return 'EXPIRED';
  return 'UNAVAILABLE';
}

/** Recomputes and persists a title's availability from its sources/assets. */
export async function recomputeTitleAvailability(
  tx: Prisma.TransactionClient,
  titleId: string,
): Promise<AvailabilityStatus> {
  const [sources, assets] = await Promise.all([
    tx.videoSource.findMany({ where: { titleId }, select: { status: true, expiresAt: true } }),
    tx.videoAsset.findMany({ where: { titleId }, select: { status: true } }),
  ]);
  const availability = deriveAvailability(sources, assets);
  await tx.title.update({ where: { id: titleId }, data: { availability } });
  return availability;
}
