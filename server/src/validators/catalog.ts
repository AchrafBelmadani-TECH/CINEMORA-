import { z } from 'zod';

export const mediaTypeSchema = z.enum(['movie', 'tv']);
export const trendingWindowSchema = z.enum(['day', 'week']);
export const pageSchema = z.coerce.number().int().min(1).max(500).default(1);

/** Whitelisted TMDB genre ids used by homepage rows (stable TMDB taxonomy). */
export const genreRowSchema = z.object({
  mediaType: mediaTypeSchema.default('movie'),
  genreId: z.coerce.number().int().min(1),
  page: pageSchema,
});

export const trendingQuerySchema = z.object({
  window: trendingWindowSchema.default('day'),
  page: pageSchema,
});

export const pageQuerySchema = z.object({ page: pageSchema });

export const genreQuerySchema = z.object({ mediaType: mediaTypeSchema.default('movie') });

export type TrendingQuery = z.infer<typeof trendingQuerySchema>;
export type PageQuery = z.infer<typeof pageQuerySchema>;
export type GenreQuery = z.infer<typeof genreQuerySchema>;
export type GenreRowParams = z.infer<typeof genreRowSchema>;
