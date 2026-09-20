import { describe, it, expect } from '@jest/globals';
import {
  CORDOBA_TIMEZONE,
  addLocalDateDays,
  cordobaDisplayDate,
  cordobaLocalDate,
  cordobaLocalDateToUtcRange,
  cordobaWeekdayIndex,
  localDateWeekdayIndex,
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

  it('returns a Monday-first weekday index in Córdoba', () => {
    // 2026-09-24 is a Thursday → index 3
    expect(cordobaWeekdayIndex(new Date('2026-09-24T12:00:00.000Z'))).toBe(3);
    // 2026-09-21 is a Monday → index 0
    expect(cordobaWeekdayIndex(new Date('2026-09-21T12:00:00.000Z'))).toBe(0);
    // Sunday on the Córdoba side of midnight → index 6
    expect(cordobaWeekdayIndex(new Date('2026-09-21T02:00:00.000Z'))).toBe(6);
  });

  it('returns a Monday-first weekday index from a calendar date string', () => {
    expect(localDateWeekdayIndex('2026-09-21')).toBe(0); // Monday
    expect(localDateWeekdayIndex('2026-09-24')).toBe(3); // Thursday
    expect(localDateWeekdayIndex('2026-09-27')).toBe(6); // Sunday
  });

  it('rejects an invalid calendar date string', () => {
    expect(() => localDateWeekdayIndex('2026/09/21')).toThrow();
    expect(() => localDateWeekdayIndex('nope')).toThrow();
  });

  describe('cordobaLocalDateToUtcRange', () => {
    it('maps a local date to its UTC-3 day window (local midnight = 03:00 UTC)', () => {
      const { startUtc, endUtc } = cordobaLocalDateToUtcRange('2026-09-24');
      expect(startUtc.toISOString()).toBe('2026-09-24T03:00:00.000Z');
      expect(endUtc.toISOString()).toBe('2026-09-25T03:00:00.000Z');
    });

    it('produces a window that contains a late-night local instant', () => {
      // 2026-09-25T02:00:00Z is 2026-09-24 23:00 in Córdoba.
      const instant = new Date('2026-09-25T02:00:00.000Z');
      const { startUtc, endUtc } = cordobaLocalDateToUtcRange('2026-09-24');
      expect(instant.getTime()).toBeGreaterThanOrEqual(startUtc.getTime());
      expect(instant.getTime()).toBeLessThan(endUtc.getTime());
    });

    it('rejects an invalid calendar date string', () => {
      expect(() => cordobaLocalDateToUtcRange('2026/09/24')).toThrow();
    });
  });
});
