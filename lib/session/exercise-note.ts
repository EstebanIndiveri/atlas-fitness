/**
 * Canonical exercise-session note rules (Atlas v0.11, Workstream A).
 *
 * A note is explicit, user-declared text attached to one exercise inside one
 * workout. The domain bound is measured in Unicode **code points** and must be
 * counted with `Array.from(value).length`. JavaScript `String.prototype.length`
 * counts UTF-16 code units, so a single astral character (e.g. an emoji
 * surrogate pair) would count as two; it is never authoritative for this bound.
 *
 * This is the single shared helper for the 280 code-point rule. Persistence,
 * API parsers and UI counters must all import it instead of re-implementing it.
 */

/** Maximum stored exercise-note length, in Unicode code points. */
export const EXERCISE_NOTE_MAX_CODE_POINTS = 280;

/**
 * Counts the Unicode code points in `value`, treating surrogate pairs as one.
 *
 * @param value Raw string to measure.
 * @returns Number of Unicode code points.
 * @example countExerciseNoteCodePoints('😀') // 1
 */
export function countExerciseNoteCodePoints(value: string): number {
  return Array.from(value).length;
}

/**
 * Trims surrounding whitespace from a user-declared exercise note.
 *
 * @param value Raw user input.
 * @returns The note without leading or trailing whitespace.
 * @example normalizeExerciseNote('  hombro ok  ') // 'hombro ok'
 */
export function normalizeExerciseNote(value: string): string {
  return value.trim();
}

/**
 * Outcome of validating an untrusted exercise-note value.
 *
 * - `not_text`: the value was not a string.
 * - `empty`: the value was empty or whitespace-only after trimming.
 * - `too_long`: the trimmed note exceeded the code-point bound.
 */
export type ExerciseNoteValidation =
  | { readonly ok: true; readonly note: string }
  | { readonly ok: false; readonly reason: 'not_text' | 'empty' | 'too_long' };

/**
 * Totally validates and normalizes an untrusted note value: rejects non-strings,
 * trims whitespace, requires non-empty content and enforces the shared
 * {@link EXERCISE_NOTE_MAX_CODE_POINTS} code-point bound.
 *
 * @param value Untrusted value from parsed JSON or user input.
 * @returns A discriminated result carrying the normalized note when valid.
 * @example
 * validateExerciseNote('  subí 2.5 kg  ');
 * // { ok: true, note: 'subí 2.5 kg' }
 */
export function validateExerciseNote(value: unknown): ExerciseNoteValidation {
  if (typeof value !== 'string') {
    return { ok: false, reason: 'not_text' };
  }

  const note = normalizeExerciseNote(value);
  if (note === '') {
    return { ok: false, reason: 'empty' };
  }

  if (countExerciseNoteCodePoints(note) > EXERCISE_NOTE_MAX_CODE_POINTS) {
    return { ok: false, reason: 'too_long' };
  }

  return { ok: true, note };
}

/**
 * Type guard for notes that are already stored in canonical form: a trimmed,
 * non-empty string within the code-point bound. Parsers use this to reject
 * impossible persisted states (untrimmed or over-long text).
 *
 * @param value Untrusted persisted value.
 * @returns `true` when `value` is a canonical exercise note.
 * @example isCanonicalExerciseNote('todo bien') // true
 */
export function isCanonicalExerciseNote(value: unknown): value is string {
  const result = validateExerciseNote(value);
  return result.ok && result.note === value;
}
