const ONBOARDING_DONE_STORAGE_KEY = 'atlas:onboarding:welcome-done';

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

/**
 * Reads whether the first-run onboarding was completed in this browser.
 * @returns True when localStorage contains the completion marker; false on SSR or storage failure.
 * @example
 * if (!isOnboardingDone()) {
 *   // render onboarding
 * }
 */
export function isOnboardingDone(): boolean {
  const storage = getLocalStorage();
  if (!storage) {
    return false;
  }

  try {
    return storage.getItem(ONBOARDING_DONE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Persists onboarding completion for this browser without throwing on storage failure.
 * @returns Nothing.
 * @example
 * markOnboardingDone();
 */
export function markOnboardingDone(): void {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(ONBOARDING_DONE_STORAGE_KEY, 'true');
  } catch {
    // Storage can be unavailable in private browsing or locked-down webviews.
  }
}
