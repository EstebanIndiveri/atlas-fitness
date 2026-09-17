/**
 * Detects UNIQUE constraint failures from libSQL / Drizzle.
 */
export function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const causeMessage = error.cause instanceof Error ? error.cause.message : '';
  const haystack = `${error.message} ${causeMessage}`.toLowerCase();
  return haystack.includes('unique');
}
