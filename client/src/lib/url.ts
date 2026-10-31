/** Clamps a raw ?page value to valid bounds (1..maxPage). */
export function parsePageParam(pageParam: string | null | undefined, maxPage = 500): number {
  const parsed = Number.parseInt(pageParam ?? '1', 10);
  if (Number.isNaN(parsed) || parsed < 1) return 1;
  return Math.min(parsed, maxPage);
}
