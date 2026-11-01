import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { MAX_PROFILES_PER_ACCOUNT } from './auth.service.js';
import type { ProfileCreateInput } from '../../validators/auth.js';

export interface ProfileDto {
  id: string;
  name: string;
  avatarKey: string;
  createdAt: Date;
}

function toDto(profile: { id: string; name: string; avatarKey: string; createdAt: Date }): ProfileDto {
  return { id: profile.id, name: profile.name, avatarKey: profile.avatarKey, createdAt: profile.createdAt };
}

export async function listProfiles(userId: string): Promise<ProfileDto[]> {
  const profiles = await prisma.profile.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });
  return profiles.map(toDto);
}

export async function createProfile(userId: string, input: ProfileCreateInput): Promise<ProfileDto> {
  const count = await prisma.profile.count({ where: { userId } });
  if (count >= MAX_PROFILES_PER_ACCOUNT) {
    throw AppError.conflict(`Accounts are limited to ${MAX_PROFILES_PER_ACCOUNT} profiles`);
  }
  const profile = await prisma.profile.create({
    data: { userId, name: input.name, avatarKey: input.avatarKey },
  });
  return toDto(profile);
}

/** Owner-checked update — a profile may only be edited by its account. */
export async function updateProfile(
  userId: string,
  profileId: string,
  patch: { name?: string; avatarKey?: string },
): Promise<ProfileDto> {
  const owned = await prisma.profile.findFirst({ where: { id: profileId, userId } });
  if (!owned) throw AppError.notFound('Profile not found');
  const updated = await prisma.profile.update({
    where: { id: profileId },
    data: patch,
  });
  return toDto(updated);
}

export async function deleteProfile(userId: string, profileId: string): Promise<void> {
  const owned = await prisma.profile.findFirst({ where: { id: profileId, userId } });
  if (!owned) throw AppError.notFound('Profile not found');
  const count = await prisma.profile.count({ where: { userId } });
  if (count <= 1) throw AppError.badRequest('An account must keep at least one profile');
  await prisma.profile.delete({ where: { id: profileId } });
}

export async function getPreferences(userId: string, profileId: string) {
  const owned = await prisma.profile.findFirst({ where: { id: profileId, userId } });
  if (!owned) throw AppError.notFound('Profile not found');
  return prisma.userPreference.upsert({
    where: { profileId },
    create: { profileId },
    update: {},
  });
}

export async function updatePreferences(
  userId: string,
  profileId: string,
  patch: { preferredLanguage?: string; subtitleLanguage?: string | null; autoplayNext?: boolean },
) {
  const owned = await prisma.profile.findFirst({ where: { id: profileId, userId } });
  if (!owned) throw AppError.notFound('Profile not found');
  await prisma.userPreference.upsert({ where: { profileId }, create: { profileId }, update: {} });
  return prisma.userPreference.update({ where: { profileId }, data: patch });
}
