/**
 * Client-side dedupe guard for the one-shot verified-PR celebration
 * (Atlas v0.13 workstream E, brief §19/E10–E11).
 *
 * There is deliberately no persisted seen-state and no API/schema change. The
 * guard is only a presentation safeguard: an in-memory set for the current
 * page session plus a `sessionStorage` key so a same-tab refresh/back cannot
 * replay the animation. Cross-device/global exactly-once behavior is not
 * promised. Storage failure degrades safely and never blocks the workout close.
 */

const STORAGE_PREFIX = 'atlas:verified-pr:';

const memoryGuard = new Set<string>();

function sessionStorageOrNull(): Storage | null {
  try {
    if (typeof window === 'undefined') {
      return null;
    }
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/** Whether this exact verified-PR event was already exposed for this tab. */
export function hasPrEventBeenSeen(key: string): boolean {
  if (memoryGuard.has(key)) {
    return true;
  }
  const storage = sessionStorageOrNull();
  if (!storage) {
    return false;
  }
  try {
    return storage.getItem(STORAGE_PREFIX + key) !== null;
  } catch {
    return false;
  }
}

/**
 * Marks the event as seen. Must be called BEFORE exposing the celebration.
 * In-memory marking always succeeds; storage is best-effort.
 */
export function markPrEventSeen(key: string): void {
  memoryGuard.add(key);
  const storage = sessionStorageOrNull();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(STORAGE_PREFIX + key, '1');
  } catch {
    // Storage unavailable or full: the in-memory guard still prevents replay
    // within this page session, and the close flow is never blocked.
  }
}

/** Test-only reset of the in-memory guard. */
export function resetPrEventGuardForTests(): void {
  memoryGuard.clear();
}
