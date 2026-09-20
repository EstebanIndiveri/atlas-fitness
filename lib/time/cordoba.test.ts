import { describe, it, expect } from '@jest/globals';
import {
  CORDOBA_TIMEZONE,
  addLocalDateDays,
  cordobaDisplayDate,
  cordobaLocalDate,
  yesterdayCordoba,
} from './cordoba';

describe('Córdoba timezone helpers', () => {
  it('declares America/Argentina/Cordoba as the canonical timezone', () => {
    expect(CORDOBA_TIMEZONE).toBe('America/Argentina/Cordoba');
  });

  it('formats a midday UTC instant as the same calendar date in Córdoba (UTC−3)', () => {
    const instant = new Date('2026-09-17T15:00:00.000Z');
    expect(cordobaLocalDate(instant)).toBe('2026-09-17');
  });

  it('uses Córdoba not UTC across the midnight boundary', () => {
    // 2026-09-17T02:30:00Z = 2026-09-16 23:30 in Córdoba
    expect(cordobaLocalDate(new Date('2026-09-17T02:30:00.000Z'))).toBe('2026-09-16');
    // 2026-09-17T03:00:00Z = 2026-09-17 00:00 in Córdoba
    expect(cordobaLocalDate(new Date('2026-09-17T03:00:00.000Z'))).toBe('2026-09-17');
  });

  it('adds and subtracts calendar days without UTC shift', () => {
    expect(addLocalDateDays('2026-09-17', -1)).toBe('2026-09-16');
    expect(addLocalDateDays('2026-09-17', 1)).toBe('2026-09-18');
    expect(addLocalDateDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addLocalDateDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('returns yesterday in Córdoba for a given instant', () => {
    expect(yesterdayCordoba(new Date('2026-09-17T15:00:00.000Z'))).toBe('2026-09-16');
  });

  it('formats a human display date in es-AR for Córdoba', () => {
    // 2026-09-24T12:00:00Z = jueves 24 de septiembre in Córdoba
    expect(cordobaDisplayDate(new Date('2026-09-24T12:00:00.000Z'))).toBe(
      'jueves, 24 de septiembre',
    );
  });

  it('resolves the display date on the Córdoba side of midnight', () => {
    // 2026-09-25T02:00:00Z = 2026-09-24 23:00 in Córdoba
    expect(cordobaDisplayDate(new Date('2026-09-25T02:00:00.000Z'))).toBe(
      'jueves, 24 de septiembre',
    );
  });
});
