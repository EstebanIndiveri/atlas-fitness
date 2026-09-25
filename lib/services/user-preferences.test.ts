import { describe, expect, it } from '@jest/globals';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { getUserPreferences, saveUserPreferences } from './user-preferences';
import { AppError } from '@/types/errors';

let userSequence = 0;

async function createUser(): Promise<number> {
  userSequence += 1;
  const [user] = await db
    .insert(users)
    .values({
      name: 'Preferences Test User',
      email: `preferences-${Date.now()}-${userSequence}@test.com`,
      passwordHash: 'hash',
    })
    .returning({ id: users.id });

  return user.id;
}

describe('user preferences service', () => {
  it('returns truthful null preferences when no row exists', async () => {
    const userId = await createUser();

    await expect(getUserPreferences(userId)).resolves.toEqual({
      goal: null,
      pace: null,
      equipment: null,
    });
  });

  it('persists the exact selected option IDs, including days-5', async () => {
    const userId = await createUser();

    await expect(
      saveUserPreferences(userId, {
        goal: 'strength',
        pace: 'days-5',
        equipment: 'bands',
      }),
    ).resolves.toEqual({
      goal: 'strength',
      pace: 'days-5',
      equipment: 'bands',
    });
  });

  it('persists explicit null values', async () => {
    const userId = await createUser();

    await expect(
      saveUserPreferences(userId, {
        goal: null,
        pace: null,
        equipment: null,
      }),
    ).resolves.toEqual({
      goal: null,
      pace: null,
      equipment: null,
    });
  });

  it.each([
    { goal: 'unknown-goal', pace: 'days-3', equipment: 'gym' },
    { goal: 'strength', pace: 'days-6', equipment: 'gym' },
    { goal: 'strength', pace: 'days-3', equipment: 'unknown-equipment' },
  ])('rejects option IDs outside the onboarding choices: %o', async (preferences) => {
    const userId = await createUser();

    await expect(saveUserPreferences(userId, preferences)).rejects.toMatchObject({
      code: 'VALIDATION',
    });
  });

  it('keeps each user preferences isolated from other accounts', async () => {
    const ownerId = await createUser();
    const otherUserId = await createUser();

    await saveUserPreferences(ownerId, {
      goal: 'muscle',
      pace: 'days-4',
      equipment: 'gym',
    });

    await expect(getUserPreferences(otherUserId)).resolves.toEqual({
      goal: null,
      pace: null,
      equipment: null,
    });
    await expect(getUserPreferences(ownerId)).resolves.toEqual({
      goal: 'muscle',
      pace: 'days-4',
      equipment: 'gym',
    });
  });

  it('rejects invalid user IDs with a typed validation error', async () => {
    await expect(
      saveUserPreferences(0, {
        goal: null,
        pace: null,
        equipment: null,
      }),
    ).rejects.toThrow(AppError);
  });
});
