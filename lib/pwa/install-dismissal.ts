const INSTALL_DISMISSAL_STORAGE_KEY = 'atlas:pwa-install-dismissed';

/**
 * Reads whether the user already dismissed the proactive install prompt.
 *
 * @returns `true` when dismissal was persisted in this browser; otherwise `false`.
 * @example
 * if (isInstallDismissed()) {
 *   return null;
 * }
 */
export function isInstallDismissed(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.localStorage.getItem(INSTALL_DISMISSAL_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Persists that the user dismissed the proactive install prompt.
 *
 * @returns Nothing. Storage failures are ignored so private browsing cannot crash the UI.
 * @example
 * markInstallDismissed();
 */
export function markInstallDismissed(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(INSTALL_DISMISSAL_STORAGE_KEY, 'true');
  } catch {
    // Private browsing can block localStorage writes; in-memory dismissal still applies.
  }
}
