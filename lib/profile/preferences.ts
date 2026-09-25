import { ONBOARDING_COPY, type OnboardingOption } from '@/lib/copy/onboarding';
import { PROFILE_PREFERENCES_COPY } from '@/lib/copy/profile';
import type { OnboardingAnswers } from '@/lib/onboarding/state';
import type { UserPreferences, UserPreferencesResponse } from '@/types/user-preferences';

export const PROFILE_PREFERENCES_ENDPOINT = '/api/profile/preferences';
export const EMPTY_USER_PREFERENCES: UserPreferences = { goal: null, pace: null, equipment: null };

interface PreferenceField {
  readonly id: keyof UserPreferences;
  readonly label: string;
  readonly options: readonly OnboardingOption[];
}

export const PROFILE_PREFERENCE_FIELDS = [
  {
    id: 'goal',
    label: ONBOARDING_COPY.proposal.goalLabel,
    options: ONBOARDING_COPY.steps[0].options,
  },
  {
    id: 'pace',
    label: ONBOARDING_COPY.proposal.paceLabel,
    options: ONBOARDING_COPY.steps[1].options,
  },
  {
    id: 'equipment',
    label: ONBOARDING_COPY.proposal.equipmentLabel,
    options: ONBOARDING_COPY.steps[2].options,
  },
] as const satisfies readonly PreferenceField[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isSupportedPreference<K extends keyof UserPreferences>(
  field: K,
  value: unknown,
): value is UserPreferences[K] {
  if (value === null) {
    return true;
  }
  if (typeof value !== 'string') {
    return false;
  }
  const step = ONBOARDING_COPY.steps.find((candidate) => candidate.id === field);
  return step?.options.some((option) => option.id === value) ?? false;
}

export function isPreferencesResponse(value: unknown): value is UserPreferencesResponse {
  if (!isRecord(value) || typeof value.hasSavedPreferences !== 'boolean') {
    return false;
  }
  const preferences = value.preferences;
  if (
    !isRecord(preferences) ||
    !isSupportedPreference('goal', preferences.goal) ||
    !isSupportedPreference('pace', preferences.pace) ||
    !isSupportedPreference('equipment', preferences.equipment)
  ) {
    return false;
  }
  return value.hasSavedPreferences || Object.values(preferences).every((preference) => preference === null);
}

export function isValidLegacyAnswers(answers: OnboardingAnswers): boolean {
  return (
    isSupportedPreference('goal', answers.goal) &&
    isSupportedPreference('pace', answers.pace) &&
    isSupportedPreference('equipment', answers.equipment)
  );
}

function responseError(status: number, unauthorizedMessage: string, failureMessage: string): Error {
  return new Error(status === 401 ? unauthorizedMessage : failureMessage);
}

/**
 * Reads the authenticated user's saved Coach preferences from the API.
 * @param signal - Optional cancellation signal for an in-flight component request.
 * @returns The validated server response, including saved-row metadata.
 * @throws {Error} When the request fails, the session is expired, or the response is invalid.
 * @example await requestSavedPreferences();
 */
export async function requestSavedPreferences(signal?: AbortSignal): Promise<UserPreferencesResponse> {
  let response: Response;
  try {
    response = await fetch(PROFILE_PREFERENCES_ENDPOINT, signal ? { signal } : undefined);
  } catch {
    throw new Error(PROFILE_PREFERENCES_COPY.loadError);
  }
  if (!response.ok) {
    throw responseError(
      response.status,
      PROFILE_PREFERENCES_COPY.loadUnauthorized,
      PROFILE_PREFERENCES_COPY.loadError,
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(PROFILE_PREFERENCES_COPY.loadError);
  }
  if (!isPreferencesResponse(body)) {
    throw new Error(PROFILE_PREFERENCES_COPY.loadError);
  }
  return body;
}

export function profilePreferenceErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function preferenceRequestError(status: number, unauthorizedMessage: string, failureMessage: string): Error {
  return responseError(status, unauthorizedMessage, failureMessage);
}
