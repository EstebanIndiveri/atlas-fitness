import { ONBOARDING_COPY } from '@/lib/copy/onboarding';
import type { OnboardingAnswers } from '@/lib/onboarding/state';
import type { UserPreferencesResponse } from '@/types/user-preferences';

const PREFERENCES_ENDPOINT = '/api/profile/preferences';
type PreferenceRequestInit = {
  method: 'GET' | 'PUT';
  headers?: Record<string, string>;
  body?: string;
};

type LegacyImportResult = 'imported' | 'already-saved';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSupportedOption(stepId: keyof OnboardingAnswers, value: string | null): boolean {
  return (
    value === null ||
    ONBOARDING_COPY.steps.some(
      (step) => step.id === stepId && step.options.some((option) => option.id === value),
    )
  );
}

function isPreferencesResponse(value: unknown): value is UserPreferencesResponse {
  if (!isRecord(value) || typeof value.hasSavedPreferences !== 'boolean') {
    return false;
  }
  const preferences = value.preferences;
  if (!isRecord(preferences)) {
    return false;
  }
  return (['goal', 'pace', 'equipment'] as const).every((stepId) => {
    const optionId = preferences[stepId];
    return optionId === null || typeof optionId === 'string';
  });
}

async function requestPreferences(
  init: PreferenceRequestInit,
  errorMessage: string,
): Promise<Response> {
  try {
    return await fetch(PREFERENCES_ENDPOINT, init);
  } catch {
    throw new Error(errorMessage);
  }
}

/**
 * Persists freshly selected onboarding answers after the user explicitly finishes.
 *
 * @param answers - Answers reviewed and submitted by the user.
 * @returns Nothing; an unauthenticated response leaves the answers browser-local.
 * @throws {Error} When an authenticated preference write cannot be completed.
 * @example
 * await syncOnboardingPreferences(answers);
 */
export async function syncOnboardingPreferences(answers: OnboardingAnswers): Promise<void> {
  const response = await requestPreferences(
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(answers),
    },
    ONBOARDING_COPY.sync.finishFailure,
  );

  if (response.status === 401) {
    return;
  }
  if (!response.ok) {
    throw new Error(ONBOARDING_COPY.sync.finishFailure);
  }
}

/**
 * Imports browser-local legacy answers only when the account has no saved row.
 *
 * @param answers - Legacy answers explicitly confirmed by the signed-in user.
 * @returns Whether the answers were imported or a saved row already existed.
 * @throws {Error} When authentication, response validation, or persistence fails.
 * @example
 * await importLegacyPreferencesIfMissing(answers);
 */
export async function importLegacyPreferencesIfMissing(
  answers: OnboardingAnswers,
): Promise<LegacyImportResult> {
  if (
    !isSupportedOption('goal', answers.goal) ||
    !isSupportedOption('pace', answers.pace) ||
    !isSupportedOption('equipment', answers.equipment)
  ) {
    throw new Error(ONBOARDING_COPY.sync.importFailure);
  }

  const getResponse = await requestPreferences(
    { method: 'GET' },
    ONBOARDING_COPY.sync.importFailure,
  );
  if (getResponse.status === 401) {
    throw new Error(ONBOARDING_COPY.sync.importUnauthorized);
  }
  if (!getResponse.ok) {
    throw new Error(ONBOARDING_COPY.sync.importFailure);
  }

  let currentPreferences: unknown;
  try {
    currentPreferences = await getResponse.json();
  } catch {
    throw new Error(ONBOARDING_COPY.sync.importFailure);
  }
  if (!isPreferencesResponse(currentPreferences)) {
    throw new Error(ONBOARDING_COPY.sync.importFailure);
  }
  if (currentPreferences.hasSavedPreferences) {
    return 'already-saved';
  }

  const putResponse = await requestPreferences(
    {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'If-None-Match': '*',
      },
      body: JSON.stringify(answers),
    },
    ONBOARDING_COPY.sync.importFailure,
  );
  if (putResponse.status === 401) {
    throw new Error(ONBOARDING_COPY.sync.importUnauthorized);
  }
  if (putResponse.status === 409) {
    return 'already-saved';
  }
  if (!putResponse.ok) {
    throw new Error(ONBOARDING_COPY.sync.importFailure);
  }
  return 'imported';
}
