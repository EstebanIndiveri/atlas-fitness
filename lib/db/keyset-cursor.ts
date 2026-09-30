/**
 * Opaque keyset cursors for bounded exercise-history pages.
 *
 * The cursor is a base64url-encoded JSON tuple of the page's sort key. It is
 * intentionally opaque to clients: the server is free to change the sort
 * columns without a contract change, as long as the ordering stays total.
 */

export interface ExerciseHistoryCursor {
  /** ISO timestamp of the primary sort key (workout start or close time). */
  sortAt: string;
  workoutId: number;
  setIndex: number;
  setId: number;
}

function isFiniteInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

/** Serializes a cursor tuple; throws on non-serializable input. */
export function encodeExerciseHistoryCursor(cursor: ExerciseHistoryCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

/**
 * Parses a cursor. Returns `null` for any malformed or out-of-shape value so
 * the route can answer with a typed `VALIDATION` error instead of crashing.
 */
export function decodeExerciseHistoryCursor(value: string): ExerciseHistoryCursor | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    if (
      typeof record.sortAt !== 'string' ||
      Number.isNaN(Date.parse(record.sortAt)) ||
      !isFiniteInteger(record.workoutId) ||
      !isFiniteInteger(record.setIndex) ||
      !isFiniteInteger(record.setId)
    ) {
      return null;
    }
    return {
      sortAt: record.sortAt,
      workoutId: record.workoutId,
      setIndex: record.setIndex,
      setId: record.setId,
    };
  } catch {
    return null;
  }
}
