import { z } from 'zod';

export const mediaTypeSchema = z.enum(['movie', 'tv']);
export const trendingWindowSchema = z.enum(['day', 'week']);
export const pageSchema = z.coerce.number().int().min(1).max(500).default(1);
export const idSchema = z.coerce.number().int().min(1);

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

export const titleParamsSchema = z.object({ id: idSchema });

export const seasonParamsSchema = z.object({
  id: idSchema,
  seasonNumber: z.coerce.number().int().min(0).max(200),
});

export const searchQuerySchema = z.object({
  query: z.string().trim().min(1).max(200),
  page: pageSchema,
});

const csvGenres = z
  .string()
  .regex(/^\d+(,\d+)*$/, 'genres must be comma-separated integers')
  .optional();

export const discoverQuerySchema = z
  .object({
    mediaType: mediaTypeSchema.default('movie'),
    page: pageSchema,
    genreId: z.coerce.number().int().min(1).optional(),
    genres: csvGenres,
    yearFrom: z.coerce.number().int().min(1900).max(2100).optional(),
    yearTo: z.coerce.number().int().min(1900).max(2100).optional(),
    voteAverageGte: z.coerce.number().min(0).max(10).optional(),
    language: z.string().trim().regex(/^[a-z]{2}$/, 'language must be a 2-letter code').optional(),
    sortBy: z.enum(['popularity.desc', 'vote_average.desc', 'release_date.desc']).default('popularity.desc'),
  })
  .refine((v) => v.yearFrom === undefined || v.yearTo === undefined || v.yearFrom <= v.yearTo, {
    message: 'yearFrom must be ≤ yearTo',
    path: ['yearFrom'],
  });

export type TrendingQuery = z.infer<typeof trendingQuerySchema>;
export type PageQuery = z.infer<typeof pageQuerySchema>;
export type GenreQuery = z.infer<typeof genreQuerySchema>;
export type GenreRowParams = z.infer<typeof genreRowSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type DiscoverQuery = z.infer<typeof discoverQuerySchema>;
