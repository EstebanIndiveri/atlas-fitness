import { eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { userPreferences, users } from '@/lib/db/schema';
import { parseUserPreferences } from '@/lib/services/user-preferences';
import { AppError } from '@/types/errors';
import type { UserOnboardingState } from '@/types/user-onboarding';
import type { UserPreferences } from '@/types/user-preferences';

export type CompleteUserOnboardingInput =
  | { action: 'skip' }
  | { action: 'finish'; answers: unknown };

function parseUserId(userId: number): number {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new AppError('VALIDATION', 'Onboarding inválido');
  }
  return userId;
}

/**
 * Reads the account's persisted onboarding-completion state.
 *
 * @param userId - Authenticated account identifier.
 * @returns Whether this account has completed onboarding.
 * @throws {AppError} VALIDATION for an invalid ID or NOT_FOUND for a missing account.
 * @example await getUserOnboardingState(42);
 */
export async function getUserOnboardingState(userId: number): Promise<UserOnboardingState> {
  const validUserId = parseUserId(userId);
  const [user] = await db
    .select({ onboardingCompletedAt: users.onboardingCompletedAt })
    .from(users)
    .where(eq(users.id, validUserId))
    .limit(1);

  if (!user) {
    throw new AppError('NOT_FOUND', 'No encontramos tu cuenta.');
  }

  return { completed: user.onboardingCompletedAt !== null };
}

/**
 * Marks onboarding complete, atomically saving explicit Finish preferences when supplied.
 *
 * @param userId - Authenticated account identifier.
 * @param input - Explicit Finish answers or the Skip action.
 * @returns The completed state for the account.
 * @throws {AppError} VALIDATION for invalid IDs or Finish answers; NOT_FOUND for a missing account.
 * @example await completeUserOnboarding(42, { action: 'skip' });
 */
export async function completeUserOnboarding(
  userId: number,
  input: CompleteUserOnboardingInput,
): Promise<UserOnboardingState> {
  const validUserId = parseUserId(userId);
  const preferences: UserPreferences | null =
    input.action === 'finish' ? parseUserPreferences(input.answers) : null;
  const completedAt = new Date();

  await db.transaction(async (transaction) => {
    if (preferences) {
      await transaction
        .insert(userPreferences)
        .values({
          userId: validUserId,
          ...preferences,
          updatedAt: completedAt,
        })
        .onConflictDoUpdate({
          target: userPreferences.userId,
          set: {
            ...preferences,
            updatedAt: completedAt,
          },
        });
    }

    const updatedUsers = await transaction
      .update(users)
      .set({ onboardingCompletedAt: completedAt })
      .where(eq(users.id, validUserId))
      .returning({ id: users.id });

    if (updatedUsers.length === 0) {
      throw new AppError('NOT_FOUND', 'No encontramos tu cuenta.');
    }
  });

  return { completed: true };
}
