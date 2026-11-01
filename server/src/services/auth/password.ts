import argon from 'argon2';

/**
 * argon2id password hashing (ADR #6) — memory-hard, current best practice.
 * Prebuilt win-x64 binaries; no fallback path exists by design.
 */
export async function hashPassword(plain: string): Promise<string> {
  return argon.hash(plain, {
    type: argon.argon2id,
    memoryCost: 19_456, // 19 MiB (OWASP baseline)
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon.verify(hash, plain);
  } catch {
    // malformed hash stored — treat as failed verification
    return false;
  }
}
