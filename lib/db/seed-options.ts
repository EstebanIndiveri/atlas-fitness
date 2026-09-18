/**
 * Determines whether the optional QA account should be seeded.
 *
 * @param env - Environment variables controlling the seed.
 * @returns Whether the QA user and its related data should be created.
 * @throws When QA seeding is explicitly enabled in production.
 * @example
 * shouldSeedQaUser({ NODE_ENV: 'test', SEED_QA_USER: 'true' });
 */
export function shouldSeedQaUser(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.SEED_QA_USER !== 'true') {
    return false;
  }

  if (env.NODE_ENV === 'production') {
    throw new Error('QA seed is forbidden in production');
  }

  return true;
}
