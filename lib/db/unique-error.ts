function errorHaystack(error: unknown): string {
  if (!(error instanceof Error)) {
    return '';
  }

  const causeMessage = error.cause instanceof Error ? error.cause.message : '';
  return `${error.message} ${causeMessage}`.toLowerCase();
}

/**
 * Detects UNIQUE constraint failures from libSQL / Drizzle.
 */
export function isUniqueConstraintError(error: unknown): boolean {
  return errorHaystack(error).includes('unique');
}

/**
 * Detects SQLite lock contention (concurrent writers on a file DB).
 */
export function isSqliteBusyError(error: unknown): boolean {
  const haystack = errorHaystack(error);
  return haystack.includes('busy') || haystack.includes('locked') || haystack.includes('in progress');
}
