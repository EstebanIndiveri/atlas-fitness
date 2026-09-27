const ONBOARDING_ANSWERS_STORAGE_KEY = 'atlas:onboarding:answers';

/** First-run wizard answers persisted for this browser (option ids per step). */
export interface OnboardingAnswers {
  readonly goal: string | null;
  readonly pace: string | null;
  readonly equipment: string | null;
}

/**
 * True only when running in a browser environment; false during SSR.
 * Exposed so SSR-safety can be asserted directly (a thrown/caught storage error
 * would otherwise make the guard indistinguishable from the surrounding try/catch).
 */
export function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined';
}

function getLocalStorage(): Storage | null {
  if (!isBrowserEnvironment()) {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOnboardingAnswers(value: unknown): value is OnboardingAnswers {
  if (!isRecord(value)) {
    return false;
  }
  return (['goal', 'pace', 'equipment'] as const).every(
    (key) => value[key] === null || typeof value[key] === 'string',
  );
}

/**
 * Reads the persisted first-run wizard answers for this browser.
 * @returns The stored answers, or null on SSR, storage failure, or malformed data.
 * @example
 * const answers = readOnboardingAnswers();
 */
export function readOnboardingAnswers(): OnboardingAnswers | null {
  const storage = getLocalStorage();
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(ONBOARDING_ANSWERS_STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return isOnboardingAnswers(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Persists the first-run wizard answers for this browser without throwing on failure.
 * @param answers The selected option ids per wizard step.
 * @returns Nothing.
 * @example
 * saveOnboardingAnswers({ goal: 'muscle', pace: 'days-3', equipment: 'gym' });
 */
export function saveOnboardingAnswers(answers: OnboardingAnswers): void {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(ONBOARDING_ANSWERS_STORAGE_KEY, JSON.stringify(answers));
  } catch {
    // Storage can be unavailable in private browsing or locked-down webviews.
  }
}

/**
 * Removes browser-local onboarding answers after a confirmed server import.
 *
 * @returns Nothing; unavailable browser storage is left unchanged.
 * @example clearOnboardingAnswers();
 */
export function clearOnboardingAnswers(): void {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(ONBOARDING_ANSWERS_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private browsing or locked-down webviews.
  }
}
