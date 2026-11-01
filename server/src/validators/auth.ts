import { z } from 'zod';

/** Curated gradient avatar presets — no user file uploads (ADR #24). */
export const AVATAR_PRESETS = [
  'aurora', 'nova', 'ember', 'frost', 'sage', 'royal',
  'dawn', 'dusk', 'jade', 'coral', 'mono', 'star',
] as const;

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128)
  .regex(/[a-zA-Z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a digit');

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address').max(200),
  password: passwordSchema,
  displayName: z.string().trim().min(2, 'Display name must be at least 2 characters').max(50),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const profileCreateSchema = z.object({
  name: z.string().trim().min(1, 'Profile name is required').max(25),
  avatarKey: z.enum(AVATAR_PRESETS).default('aurora'),
});

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(25).optional(),
  avatarKey: z.enum(AVATAR_PRESETS).optional(),
});

export const preferencesSchema = z.object({
  preferredLanguage: z.string().trim().regex(/^[a-z]{2}$/, 'Use a 2-letter language code').default('en'),
  subtitleLanguage: z.string().trim().regex(/^[a-z]{2}$/).nullable().optional(),
  autoplayNext: z.boolean().optional(),
});

export const profileIdParamsSchema = z.object({ id: z.string().uuid('Invalid profile id') });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProfileCreateInput = z.infer<typeof profileCreateSchema>;
export type PreferencesInput = z.infer<typeof preferencesSchema>;
