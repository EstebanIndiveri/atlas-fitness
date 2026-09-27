import { ONBOARDING_COPY } from '@/lib/copy/onboarding';
import type { OnboardingAnswers } from '@/lib/onboarding/state';
import type { UserOnboardingAction, UserOnboardingState } from '@/types/user-onboarding';

const ONBOARDING_ENDPOINT = '/api/profile/onboarding';

function isOnboardingState(value: unknown): value is UserOnboardingState {
  return (
    typeof value === 'object' &&
    value !== null &&
    'completed' in value &&
    typeof value.completed === 'boolean'
  );
}

function failureMessage(action: UserOnboardingAction['action'], status?: number): string {
  if (status === 401) {
    return ONBOARDING_COPY.sync.unauthorized;
  }
  return action === 'skip'
    ? ONBOARDING_COPY.sync.skipFailure
    : ONBOARDING_COPY.sync.finishFailure;
}

/**
 * Loads the server-owned completion state for the active account.
 *
 * @param signal - Optional cancellation signal.
 * @returns The persisted onboarding state.
 * @throws {Error} When the request or its response is invalid.
 * @example await getServerOnboardingState();
 */
export async function getServerOnboardingState(
  signal?: AbortSignal,
): Promise<UserOnboardingState> {
  let response: Response;
  try {
    response = await fetch(
      ONBOARDING_ENDPOINT,
      signal ? { cache: 'no-store', signal } : { cache: 'no-store' },
    );
  } catch {
    throw new Error(ONBOARDING_COPY.sync.loadFailure);
  }
  if (!response.ok) {
    throw new Error(
      response.status === 401 ? ONBOARDING_COPY.sync.unauthorized : ONBOARDING_COPY.sync.loadFailure,
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(ONBOARDING_COPY.sync.loadFailure);
  }
  if (!isOnboardingState(body)) {
    throw new Error(ONBOARDING_COPY.sync.loadFailure);
  }
  return body;
}

/**
 * Submits the user's explicit Finish or Skip action to the authenticated API.
 *
 * @param action - Finish answers or Skip without preference values.
 * @returns The persisted completion state.
 * @throws {Error} When authentication, persistence, or response validation fails.
 * @example await submitOnboardingAction({ action: 'skip' });
 */
export async function submitOnboardingAction(
  action: UserOnboardingAction,
): Promise<UserOnboardingState> {
  let response: Response;
  try {
    response = await fetch(ONBOARDING_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(action),
    });
  } catch {
    throw new Error(failureMessage(action.action));
  }
  if (!response.ok) {
    throw new Error(failureMessage(action.action, response.status));
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(failureMessage(action.action));
  }
  if (!isOnboardingState(body) || !body.completed) {
    throw new Error(failureMessage(action.action));
  }
  return body;
}

/**
 * Completes the onboarding wizard with the selected account preferences.
 *
 * @param answers - The explicit selections reviewed by the user.
 * @returns The persisted completion state.
 * @throws {Error} When preferences and completion cannot be saved together.
 * @example await finishOnboarding({ goal: 'strength', pace: 'days-3', equipment: 'gym' });
 */
export function finishOnboarding(answers: OnboardingAnswers): Promise<UserOnboardingState> {
  return submitOnboardingAction({ action: 'finish', answers });
}

/**
 * Completes onboarding without writing preference values.
 *
 * @returns The persisted completion state.
 * @throws {Error} When completion cannot be saved.
 * @example await skipOnboarding();
 */
export function skipOnboarding(): Promise<UserOnboardingState> {
  return submitOnboardingAction({ action: 'skip' });
}
