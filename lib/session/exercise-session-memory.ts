import { isValidWeightKg } from '@/lib/format/weight';
import {
  isCanonicalPositiveDecimal,
  isZeroDecimal,
  normalizeExactDecimal,
} from '@/lib/progression/decimal';
import { canonicalSemantics } from '@/lib/progression/semantics';
import { addLocalDateDays, cordobaLocalDate } from '@/lib/time/cordoba';
import type {
  ExerciseNoteValidation,
  ExerciseSessionContext,
  ExerciseSessionSetSnapshot,
  LastCompletedExerciseNote,
  LastCompletedExerciseSets,
  WorkoutExerciseNote,
} from '@/types/exercise-session-memory';

/**
 * Pure domain helpers for exercise-session memory (Atlas v0.11, Workstream A).
 *
 * Everything here is total over `unknown`: parsers reject impossible or
 * malformed states by returning `null` and never coerce, guess or invent data.
 * There is no persistence, HTTP, React or AI behavior in this module.
 */

/**
 * Maximum exercise-note length in Unicode code points (not UTF-16 units).
 *
 * Native `maxLength` and `String.prototype.length` are NOT authoritative for
 * this bound; always use {@link countExerciseNoteCodePoints}.
 */
export const MAX_EXERCISE_NOTE_CODE_POINTS = 280;

const WORKOUT_NOTE_KEYS = [
  'id',
  'userId',
  'workoutId',
  'exerciseId',
  'note',
  'version',
  'createdAt',
  'updatedAt',
] as const;

const SET_KEYS = [
  'id',
  'exerciseId',
  'setIndex',
  'reps',
  'weightKg',
  'semanticCaptureVersion',
  'loadMode',
  'amountBasis',
  'side',
  'setPurpose',
  'repCountBasis',
] as const;

const LAST_COMPLETED_SETS_KEYS = [
  'workoutId',
  'exerciseId',
  'localDate',
  'endedAt',
  'sets',
] as const;

const LAST_COMPLETED_NOTE_KEYS = [
  'workoutId',
  'exerciseId',
  'localDate',
  'endedAt',
  'noteId',
  'note',
  'version',
] as const;

const CONTEXT_KEYS = [
  'workoutId',
  'exerciseId',
  'currentNote',
  'lastCompletedSets',
  'lastCompletedNote',
] as const;

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_INSTANT_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * Counts the Unicode code points of `value`.
 *
 * Astral characters count as one, unlike UTF-16 `.length`. This is the single
 * shared helper for the 280 code-point note bound.
 *
 * @param value Text to count.
 * @returns Number of Unicode code points.
 * @example countExerciseNoteCodePoints('😀') // 1
 */
export function countExerciseNoteCodePoints(value: string): number {
  return Array.from(value).length;
}

/**
 * Trims leading and trailing whitespace only, preserving internal spacing and
 * all Unicode characters.
 *
 * @param raw Candidate note text.
 * @returns Trimmed text.
 */
export function normalizeExerciseNote(raw: string): string {
  return raw.trim();
}

/**
 * Validates and normalizes a candidate note.
 *
 * The note is trimmed; it must contain at least one Unicode code point and at
 * most {@link MAX_EXERCISE_NOTE_CODE_POINTS} code points. Non-string input,
 * whitespace-only text and overflow are rejected with a typed reason.
 *
 * @param raw Candidate value of any type.
 * @returns Validated trimmed note with its code-point count, or a rejection.
 */
export function validateExerciseNote(raw: unknown): ExerciseNoteValidation {
  if (typeof raw !== 'string') {
    return { ok: false, reason: 'not_text' };
  }

  const note = normalizeExerciseNote(raw);
  const codePoints = countExerciseNoteCodePoints(note);

  if (codePoints === 0) {
    return { ok: false, reason: 'empty' };
  }

  if (codePoints > MAX_EXERCISE_NOTE_CODE_POINTS) {
    return { ok: false, reason: 'too_long' };
  }

  return { ok: true, note, codePoints };
}

/**
 * Parses a persisted exercise note from untrusted input.
 *
 * @param value Candidate value of any type.
 * @returns The note, or `null` when the value is not a valid note record.
 */
export function parseWorkoutExerciseNote(value: unknown): WorkoutExerciseNote | null {
  if (!isRecord(value) || !hasOnlyKeys(value, WORKOUT_NOTE_KEYS)) {
    return null;
  }

  const { id, userId, workoutId, exerciseId, note, version, createdAt, updatedAt } = value;

  if (
    !isPositiveSafeInteger(id) ||
    !isPositiveSafeInteger(userId) ||
    !isPositiveSafeInteger(workoutId) ||
    !isPositiveSafeInteger(exerciseId) ||
    !isPositiveSafeInteger(version) ||
    !isIsoInstantString(createdAt) ||
    !isIsoInstantString(updatedAt) ||
    Date.parse(updatedAt) < Date.parse(createdAt)
  ) {
    return null;
  }

  const validated = validateExerciseNote(note);
  if (!validated.ok) {
    return null;
  }

  return {
    id,
    userId,
    workoutId,
    exerciseId,
    note: validated.note,
    version,
    createdAt,
    updatedAt,
  };
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/**
 * Parses one raw historical set for an exact exercise.
 *
 * `weightKg` is kept verbatim as the persisted decimal string; numbers are
 * rejected instead of coerced. A legacy row (semantic tuple all-null) keeps its
 * raw positive amount and is marked unknown. A declared row must carry a
 * complete, canonical tuple: bodyweight requires the canonical `"0"` sentinel,
 * every other mode a positive canonical decimal. A partial/corrupt tuple is
 * rejected rather than inferred.
 *
 * @param value Candidate value of any type.
 * @returns The set, or `null` when invalid.
 */
export function parseExerciseSessionSet(value: unknown): ExerciseSessionSetSnapshot | null {
  if (!isRecord(value) || !hasOnlyKeys(value, SET_KEYS)) {
    return null;
  }

  const { id, exerciseId, setIndex, reps, weightKg } = value;
  // An omitted semantic key is an explicit unknown (legacy), never inferred.
  const semanticCaptureVersion = value.semanticCaptureVersion ?? null;
  const loadMode = value.loadMode ?? null;
  const amountBasis = value.amountBasis ?? null;
  const side = value.side ?? null;
  const setPurpose = value.setPurpose ?? null;
  const repCountBasis = value.repCountBasis ?? null;

  if (
    !isPositiveSafeInteger(id) ||
    !isPositiveSafeInteger(exerciseId) ||
    !isPositiveSafeInteger(setIndex) ||
    !isPositiveSafeInteger(reps) ||
    typeof weightKg !== 'string' ||
    !isNullableString(loadMode) ||
    !isNullableString(amountBasis) ||
    !isNullableString(side) ||
    !isNullableString(setPurpose) ||
    !isNullableString(repCountBasis)
  ) {
    return null;
  }

  if (semanticCaptureVersion === null) {
    // Legacy/unknown: the whole tuple is null and only a raw positive amount is
    // accepted. Zero is not a legacy value, so it is rejected rather than
    // reinterpreted as bodyweight.
    if (
      loadMode !== null ||
      amountBasis !== null ||
      side !== null ||
      setPurpose !== null ||
      repCountBasis !== null
    ) {
      return null;
    }
    if (!isValidWeightKg(weightKg)) {
      return null;
    }
  } else {
    if (!isPositiveSafeInteger(semanticCaptureVersion)) {
      return null;
    }
    const canonical = canonicalSemantics(semanticCaptureVersion, {
      loadMode,
      amountBasis,
      side,
      setPurpose,
      repCountBasis,
    });
    if (canonical.status !== 'canonical') {
      return null;
    }
    if (canonical.tuple.loadMode === 'bodyweight') {
      if (!isZeroDecimal(weightKg) || normalizeExactDecimal(weightKg) !== '0') {
        return null;
      }
    } else if (!isCanonicalPositiveDecimal(weightKg)) {
      return null;
    }
  }

  return {
    id,
    exerciseId,
    setIndex,
    reps,
    weightKg,
    semanticCaptureVersion,
    loadMode,
    amountBasis,
    side,
    setPurpose,
    repCountBasis,
  };
}

/**
 * Parses the last completed set encounter for an exact exercise.
 *
 * @param value Candidate value of any type.
 * @returns The bounded source, or `null` when invalid or empty.
 */
export function parseLastCompletedExerciseSets(
  value: unknown,
): LastCompletedExerciseSets | null {
  if (!isRecord(value) || !hasOnlyKeys(value, LAST_COMPLETED_SETS_KEYS)) {
    return null;
  }

  const { workoutId, exerciseId, localDate, endedAt, sets } = value;

  if (
    !isPositiveSafeInteger(workoutId) ||
    !isPositiveSafeInteger(exerciseId) ||
    !isCanonicalLocalDate(localDate) ||
    !isIsoInstantString(endedAt) ||
    cordobaLocalDate(new Date(endedAt)) !== localDate ||
    !Array.isArray(sets) ||
    sets.length === 0
  ) {
    return null;
  }

  const parsedSets: ExerciseSessionSetSnapshot[] = [];
  for (const candidate of sets) {
    const parsed = parseExerciseSessionSet(candidate);
    if (!parsed || parsed.exerciseId !== exerciseId) {
      return null;
    }
    parsedSets.push(parsed);
  }

  return { workoutId, exerciseId, localDate, endedAt, sets: parsedSets };
}

/**
 * Parses the last completed note source for an exact exercise.
 *
 * @param value Candidate value of any type.
 * @returns The bounded source, or `null` when invalid.
 */
export function parseLastCompletedExerciseNote(
  value: unknown,
): LastCompletedExerciseNote | null {
  if (!isRecord(value) || !hasOnlyKeys(value, LAST_COMPLETED_NOTE_KEYS)) {
    return null;
  }

  const { workoutId, exerciseId, localDate, endedAt, noteId, note, version } = value;

  if (
    !isPositiveSafeInteger(workoutId) ||
    !isPositiveSafeInteger(exerciseId) ||
    !isPositiveSafeInteger(noteId) ||
    !isPositiveSafeInteger(version) ||
    !isCanonicalLocalDate(localDate) ||
    !isIsoInstantString(endedAt) ||
    cordobaLocalDate(new Date(endedAt)) !== localDate
  ) {
    return null;
  }

  const validated = validateExerciseNote(note);
  if (!validated.ok) {
    return null;
  }

  return { workoutId, exerciseId, localDate, endedAt, noteId, note: validated.note, version };
}

/**
 * Parses the bounded read model for one exercise encounter.
 *
 * Enforces exact `exerciseId` identity, that historical sources never point at
 * the current workout, and that the current note belongs to the requested
 * workout/exercise. `null` fields mean "absent", never zero or demo data.
 *
 * @param value Candidate value of any type.
 * @returns The context, or `null` when any part is invalid or inconsistent.
 */
export function parseExerciseSessionContext(value: unknown): ExerciseSessionContext | null {
  if (!isRecord(value) || !hasOnlyKeys(value, CONTEXT_KEYS)) {
    return null;
  }

  const { workoutId, exerciseId, currentNote, lastCompletedSets, lastCompletedNote } = value;

  if (!isPositiveSafeInteger(workoutId) || !isPositiveSafeInteger(exerciseId)) {
    return null;
  }

  const parsedCurrentNote = parseNullable(currentNote, parseWorkoutExerciseNote);
  if (parsedCurrentNote === undefined) {
    return null;
  }
  if (
    parsedCurrentNote !== null &&
    (parsedCurrentNote.workoutId !== workoutId || parsedCurrentNote.exerciseId !== exerciseId)
  ) {
    return null;
  }

  const parsedLastSets = parseNullable(lastCompletedSets, parseLastCompletedExerciseSets);
  if (parsedLastSets === undefined) {
    return null;
  }
  if (
    parsedLastSets !== null &&
    (parsedLastSets.workoutId === workoutId || parsedLastSets.exerciseId !== exerciseId)
  ) {
    return null;
  }

  const parsedLastNote = parseNullable(lastCompletedNote, parseLastCompletedExerciseNote);
  if (parsedLastNote === undefined) {
    return null;
  }
  if (
    parsedLastNote !== null &&
    (parsedLastNote.workoutId === workoutId || parsedLastNote.exerciseId !== exerciseId)
  ) {
    return null;
  }

  return {
    workoutId,
    exerciseId,
    currentNote: parsedCurrentNote,
    lastCompletedSets: parsedLastSets,
    lastCompletedNote: parsedLastNote,
  };
}

/**
 * Parses a nullable field: `null` stays `null`, a present value must parse.
 *
 * @returns The parsed value, `null` for an explicit null, or `undefined` when
 * the field is absent/invalid.
 */
function parseNullable<T>(
  value: unknown,
  parse: (candidate: unknown) => T | null,
): T | null | undefined {
  if (value === null) {
    return null;
  }
  return parse(value) ?? undefined;
}

function isCanonicalLocalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !LOCAL_DATE_RE.test(value)) {
    return false;
  }
  return addLocalDateDays(value, 0) === value;
}

function isIsoInstantString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    ISO_INSTANT_RE.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(record).every((key) => allowed.has(key));
}
