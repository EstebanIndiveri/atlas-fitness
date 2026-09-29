import { describe, expect, it } from '@jest/globals';
import {
  countExerciseNoteCodePoints,
  EXERCISE_NOTE_MAX_CODE_POINTS,
  isCanonicalExerciseNote,
  normalizeExerciseNote,
  validateExerciseNote,
} from './exercise-note';

const BMP_280 = 'a'.repeat(280);
const BMP_281 = 'a'.repeat(281);
const ASTRAL_280 = '😀'.repeat(280);
const ASTRAL_281 = '😀'.repeat(281);

describe('countExerciseNoteCodePoints', () => {
  it('counts BMP characters as one code point each', () => {
    expect(countExerciseNoteCodePoints('abc')).toBe(3);
  });

  it('counts an astral emoji as one code point despite its two UTF-16 units', () => {
    expect('😀'.length).toBe(2);
    expect(countExerciseNoteCodePoints('😀')).toBe(1);
  });

  it('counts mixed BMP and astral content by code points', () => {
    expect(countExerciseNoteCodePoints('ab😀')).toBe(3);
  });

  it('counts an empty string as zero', () => {
    expect(countExerciseNoteCodePoints('')).toBe(0);
  });
});

describe('normalizeExerciseNote', () => {
  it('trims surrounding whitespace only', () => {
    expect(normalizeExerciseNote('  hombro ok  ')).toBe('hombro ok');
    expect(normalizeExerciseNote('día  de  piernas')).toBe('día  de  piernas');
  });
});

describe('validateExerciseNote', () => {
  it('rejects non-string values without throwing', () => {
    expect(validateExerciseNote(42)).toEqual({ ok: false, reason: 'not_text' });
    expect(validateExerciseNote(null)).toEqual({ ok: false, reason: 'not_text' });
    expect(validateExerciseNote(undefined)).toEqual({ ok: false, reason: 'not_text' });
    expect(validateExerciseNote({ note: 'x' })).toEqual({ ok: false, reason: 'not_text' });
  });

  it('rejects empty and whitespace-only notes', () => {
    expect(validateExerciseNote('')).toEqual({ ok: false, reason: 'empty' });
    expect(validateExerciseNote('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(validateExerciseNote('\n\t ')).toEqual({ ok: false, reason: 'empty' });
  });

  it('returns the trimmed note when valid', () => {
    expect(validateExerciseNote('  subí 2.5 kg  ')).toEqual({ ok: true, note: 'subí 2.5 kg' });
  });

  it('accepts valid Unicode content', () => {
    const note = 'Sentí fatiga en la última serie, bajé el peso 🙌';
    expect(validateExerciseNote(note)).toEqual({ ok: true, note });
  });

  it('accepts exactly 280 code points for BMP and astral input', () => {
    expect(validateExerciseNote(BMP_280)).toEqual({ ok: true, note: BMP_280 });
    expect(validateExerciseNote(ASTRAL_280)).toEqual({ ok: true, note: ASTRAL_280 });
    // 280 astral characters are 560 UTF-16 code units but only 280 code points.
    expect(ASTRAL_280.length).toBe(560);
  });

  it('rejects 281 code points for BMP and astral input', () => {
    expect(validateExerciseNote(BMP_281)).toEqual({ ok: false, reason: 'too_long' });
    expect(validateExerciseNote(ASTRAL_281)).toEqual({ ok: false, reason: 'too_long' });
    expect(ASTRAL_281.length).toBe(562);
  });

  it('counts mixed BMP and astral content at the exact boundary', () => {
    const exactly280 = `${'😀'.repeat(279)}a`;
    const exactly281 = `${'😀'.repeat(280)}a`;

    expect(countExerciseNoteCodePoints(exactly280)).toBe(280);
    expect(validateExerciseNote(exactly280)).toEqual({ ok: true, note: exactly280 });
    expect(countExerciseNoteCodePoints(exactly281)).toBe(281);
    expect(validateExerciseNote(exactly281)).toEqual({ ok: false, reason: 'too_long' });
  });

  it('exposes the shared 280 code-point bound', () => {
    expect(EXERCISE_NOTE_MAX_CODE_POINTS).toBe(280);
  });
});

describe('isCanonicalExerciseNote', () => {
  it('accepts already-trimmed in-range notes', () => {
    expect(isCanonicalExerciseNote('todo bien')).toBe(true);
    expect(isCanonicalExerciseNote(ASTRAL_280)).toBe(true);
  });

  it('rejects untrimmed, empty, over-long or non-string values', () => {
    expect(isCanonicalExerciseNote(' todo bien')).toBe(false);
    expect(isCanonicalExerciseNote('todo bien ')).toBe(false);
    expect(isCanonicalExerciseNote('')).toBe(false);
    expect(isCanonicalExerciseNote(ASTRAL_281)).toBe(false);
    expect(isCanonicalExerciseNote(7)).toBe(false);
  });
});
