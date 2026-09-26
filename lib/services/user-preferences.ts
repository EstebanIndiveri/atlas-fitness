import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { ONBOARDING_COPY } from '@/lib/copy/onboarding';
import { db } from '@/lib/db/client';
import { userPreferences } from '@/lib/db/schema';
import { AppError } from '@/types/errors';
import type {
  UserEquipmentPreference,
  UserGoalPreference,
  UserPacePreference,
  UserPreferences as UserPreferencesDto,
  UserPreferencesResponse,
} from '@/types/user-preferences';

type UserPreferenceOptionByStep = {
  goal: UserGoalPreference;
  pace: UserPacePreference;
  equipment: UserEquipmentPreference;
};

function isOnboardingOptionId<StepId extends keyof UserPreferenceOptionByStep>(
  stepId: StepId,
  value: unknown,
): value is UserPreferenceOptionByStep[StepId] {
  return ONBOARDING_COPY.steps.some(
    (step) => step.id === stepId && step.options.some((option) => option.id === value),
  );
}

const userPreferencesSchema = z
  .object({
    goal: z.custom<UserGoalPreference | null>(
      (value): value is UserGoalPreference | null =>
        value === null || isOnboardingOptionId('goal', value),
    ),
    pace: z.custom<UserPacePreference | null>(
      (value): value is UserPacePreference | null =>
        value === null || isOnboardingOptionId('pace', value),
    ),
    equipment: z.custom<UserEquipmentPreference | null>(
      (value): value is UserEquipmentPreference | null =>
        value === null || isOnboardingOptionId('equipment', value),
    ),
  })
  .strict();

const userIdSchema = z.number().int().positive();

function parseUserId(userId: number): number {
  const parsed = userIdSchema.safeParse(userId);
  if (!parsed.success) {
    throw new AppError('VALIDATION', 'Preferencias del perfil inválidas');
  }
  return parsed.data;
}

/**
 * Validates the three preference values submitted for an account.
 *
 * @param input - Untrusted preference values.
 * @returns The validated preference values.
 * @throws {AppError} VALIDATION when the preference values are invalid.
 * @example parseUserPreferences({ goal: 'strength', pace: 'days-3', equipment: 'gym' });
 */
export function parseUserPreferences(input: unknown): UserPreferencesDto {
  const parsed = userPreferencesSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError('VALIDATION', 'Preferencias del perfil inválidas');
  }
  return parsed.data;
}

/**
 * Loads the authenticated user's saved preferences without creating a row.
 *
 * @param userId - Authenticated user identifier.
 * @returns Stored values and whether the user has an explicitly saved row.
 * @throws {AppError} VALIDATION when the user ID is invalid.
 * @example
 * const preferences = await getUserPreferences(42);
 */
export async function getUserPreferences(userId: number): Promise<UserPreferencesResponse> {
  const validUserId = parseUserId(userId);
  const row = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, validUserId),
  });

  return {
    hasSavedPreferences: row !== undefined,
    preferences: {
      goal: row?.goal ?? null,
      pace: row?.pace ?? null,
      equipment: row?.equipment ?? null,
    },
  };
}

/**
 * Replaces an authenticated user's three preference values after explicit input.
 *
 * @param userId - Authenticated user identifier.
 * @param input - Untrusted preference values validated against onboarding options.
 * @returns The validated values persisted for the user and saved-row metadata.
 * @throws {AppError} VALIDATION when the user ID or any preference is invalid.
 * @example
 * await saveUserPreferences(42, { goal: 'strength', pace: 'days-5', equipment: 'gym' });
 */
export async function saveUserPreferences(
  userId: number,
  input: unknown,
): Promise<UserPreferencesResponse> {
  const validUserId = parseUserId(userId);
  const preferences = parseUserPreferences(input);
  const now = new Date();

  await db
    .insert(userPreferences)
    .values({
      userId: validUserId,
      ...preferences,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        ...preferences,
        updatedAt: now,
      },
    });

  return {
    hasSavedPreferences: true,
    preferences,
  };
}

/**
 * Creates preferences only when the authenticated user has no saved row.
 *
 * @param userId - Authenticated user identifier.
 * @param input - Untrusted preference values validated against onboarding options.
 * @returns The values persisted for the user.
 * @throws {AppError} VALIDATION when the user ID or preference values are invalid.
 * @throws {AppError} CONFLICT when a preference row already exists.
 * @example
 * await saveUserPreferencesIfMissing(42, { goal: 'strength', pace: 'days-3', equipment: 'gym' });
 */
export async function saveUserPreferencesIfMissing(
  userId: number,
  input: unknown,
): Promise<UserPreferencesResponse> {
  const validUserId = parseUserId(userId);
  const preferences = parseUserPreferences(input);
  const now = new Date();
  const insertedRows = await db
    .insert(userPreferences)
    .values({
      userId: validUserId,
      ...preferences,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: userPreferences.userId })
    .returning({ userId: userPreferences.userId });

  if (insertedRows.length === 0) {
    throw new AppError('CONFLICT', 'Ya hay preferencias guardadas en tu cuenta');
  }

  return {
    hasSavedPreferences: true,
    preferences,
  };
}
