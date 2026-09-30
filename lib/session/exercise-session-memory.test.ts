import { describe, expect, it } from '@jest/globals';
import {
  MAX_EXERCISE_NOTE_CODE_POINTS,
  countExerciseNoteCodePoints,
  normalizeExerciseNote,
  parseWorkoutExerciseNote,
  validateExerciseNote,
} from './exercise-session-memory';

/** Astral (non-BMP) code point: 1 code point, 2 UTF-16 code units. */
const ASTRAL = '\u{1F600}';
/** BMP code point: 1 code point, 1 UTF-16 code unit. */
const BMP = 'a';

function validNoteRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 7,
    userId: 3,
    workoutId: 11,
    exerciseId: 42,
    note: 'Codo alto, sin dolor',
    version: 1,
    createdAt: '2026-09-28T12:00:00.000Z',
    updatedAt: '2026-09-28T12:05:00.000Z',
    ...overrides,
  };
}

describe('countExerciseNoteCodePoints', () => {
  it('counts astral characters as one code point, unlike UTF-16 .length', () => {
    expect(countExerciseNoteCodePoints(ASTRAL)).toBe(1);
    expect(ASTRAL.length).toBe(2);
    expect(countExerciseNoteCodePoints(BMP)).toBe(1);
  });

  it('counts mixed BMP and astral text by real code points', () => {
    expect(countExerciseNoteCodePoints(`${BMP}${ASTRAL}`)).toBe(2);
  });
});

describe('normalizeExerciseNote', () => {
  it('trims leading and trailing whitespace only', () => {
    expect(normalizeExerciseNote('  hola  ')).toBe('hola');
    expect(normalizeExerciseNote('\n\thola mundo \t')).toBe('hola mundo');
  });

  it('preserves internal whitespace and Unicode', () => {
    expect(normalizeExerciseNote('  hombro  izquierdo  ')).toBe('hombro  izquierdo');
    expect(normalizeExerciseNote('  sentí  ñandú 😀  ')).toBe('sentí  ñandú 😀');
  });

  it('collapses whitespace-only input to the empty string', () => {
    expect(normalizeExerciseNote('   ')).toBe('');
  });
});

describe('validateExerciseNote', () => {
  it('accepts a trimmed non-empty note and reports its code-point count', () => {
    expect(validateExerciseNote('  hola  ')).toEqual({
      ok: true,
      note: 'hola',
      codePoints: 4,
    });
  });

  it('accepts exactly the maximum using BMP characters', () => {
    const note = BMP.repeat(MAX_EXERCISE_NOTE_CODE_POINTS);
    const result = validateExerciseNote(note);
    expect(result).toEqual({ ok: true, note, codePoints: MAX_EXERCISE_NOTE_CODE_POINTS });
  });

  it('rejects one code point over the maximum using BMP characters', () => {
    expect(validateExerciseNote(BMP.repeat(MAX_EXERCISE_NOTE_CODE_POINTS + 1))).toEqual({
      ok: false,
      reason: 'too_long',
    });
  });

  it('accepts 280 astral code points even though .length is 560', () => {
    const note = ASTRAL.repeat(MAX_EXERCISE_NOTE_CODE_POINTS);
    expect(note.length).toBe(MAX_EXERCISE_NOTE_CODE_POINTS * 2);
    expect(validateExerciseNote(note)).toEqual({
      ok: true,
      note,
      codePoints: MAX_EXERCISE_NOTE_CODE_POINTS,
    });
  });

  it('rejects 281 astral code points', () => {
    expect(validateExerciseNote(ASTRAL.repeat(MAX_EXERCISE_NOTE_CODE_POINTS + 1))).toEqual({
      ok: false,
      reason: 'too_long',
    });
  });

  it('counts code points after trimming, so surrounding spaces do not consume the bound', () => {
    const padded = `  ${ASTRAL.repeat(MAX_EXERCISE_NOTE_CODE_POINTS)}  `;
    expect(validateExerciseNote(padded)).toEqual({
      ok: true,
      note: ASTRAL.repeat(MAX_EXERCISE_NOTE_CODE_POINTS),
      codePoints: MAX_EXERCISE_NOTE_CODE_POINTS,
    });
  });

  it('rejects empty and whitespace-only notes', () => {
    expect(validateExerciseNote('')).toEqual({ ok: false, reason: 'empty' });
    expect(validateExerciseNote('   \n\t ')).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects non-string input', () => {
    expect(validateExerciseNote(null)).toEqual({ ok: false, reason: 'not_text' });
    expect(validateExerciseNote(280)).toEqual({ ok: false, reason: 'not_text' });
    expect(validateExerciseNote({ note: 'hola' })).toEqual({ ok: false, reason: 'not_text' });
  });
});

describe('parseWorkoutExerciseNote', () => {
  it('parses a fully valid persisted note', () => {
    expect(parseWorkoutExerciseNote(validNoteRecord())).toEqual({
      id: 7,
      userId: 3,
      workoutId: 11,
      exerciseId: 42,
      note: 'Codo alto, sin dolor',
      version: 1,
      createdAt: '2026-09-28T12:00:00.000Z',
      updatedAt: '2026-09-28T12:05:00.000Z',
    });
  });

  it('normalizes an untrimmed persisted note and keeps raw Unicode', () => {
    expect(parseWorkoutExerciseNote(validNoteRecord({ note: '  ñandú 😀  ' }))?.note).toBe(
      'ñandú 😀',
    );
  });

  it('accepts a 280 astral code-point note', () => {
    const note = ASTRAL.repeat(MAX_EXERCISE_NOTE_CODE_POINTS);
    expect(parseWorkoutExerciseNote(validNoteRecord({ note }))?.note).toBe(note);
  });

  it('rejects unknown fields where the contract forbids them', () => {
    expect(parseWorkoutExerciseNote(validNoteRecord({ deltaKg: '5' }))).toBeNull();
    expect(parseWorkoutExerciseNote(validNoteRecord({ isPr: true }))).toBeNull();
  });

  it('rejects non-record and missing fields', () => {
    expect(parseWorkoutExerciseNote(null)).toBeNull();
    expect(parseWorkoutExerciseNote('note')).toBeNull();
    expect(parseWorkoutExerciseNote([])).toBeNull();
    const missing = validNoteRecord();
    delete missing.version;
    expect(parseWorkoutExerciseNote(missing)).toBeNull();
  });

  it('rejects malformed ids and versions', () => {
    expect(parseWorkoutExerciseNote(validNoteRecord({ id: 0 }))).toBeNull();
    expect(parseWorkoutExerciseNote(validNoteRecord({ id: 1.5 }))).toBeNull();
    expect(parseWorkoutExerciseNote(validNoteRecord({ userId: -1 }))).toBeNull();
    expect(parseWorkoutExerciseNote(validNoteRecord({ workoutId: '11' }))).toBeNull();
    expect(parseWorkoutExerciseNote(validNoteRecord({ exerciseId: 0 }))).toBeNull();
    expect(parseWorkoutExerciseNote(validNoteRecord({ version: 0 }))).toBeNull();
    expect(parseWorkoutExerciseNote(validNoteRecord({ version: 2.5 }))).toBeNull();
  });

  it('rejects malformed notes', () => {
    expect(parseWorkoutExerciseNote(validNoteRecord({ note: '   ' }))).toBeNull();
    expect(parseWorkoutExerciseNote(validNoteRecord({ note: 5 }))).toBeNull();
    expect(
      parseWorkoutExerciseNote(validNoteRecord({ note: BMP.repeat(MAX_EXERCISE_NOTE_CODE_POINTS + 1) })),
    ).toBeNull();
  });

  it('rejects malformed timestamps and an inverted updatedAt', () => {
    expect(parseWorkoutExerciseNote(validNoteRecord({ createdAt: 'ayer' }))).toBeNull();
    expect(parseWorkoutExerciseNote(validNoteRecord({ updatedAt: '2026-09-28' }))).toBeNull();
    expect(
      parseWorkoutExerciseNote(validNoteRecord({ updatedAt: '2026-09-28T11:00:00.000Z' })),
    ).toBeNull();
  });
});
