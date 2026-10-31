import { PrismaClient } from '@prisma/client';

/** Shared Prisma instance — one connection pool per process. */
export const prisma = new PrismaClient();
