import { describe, it, expect } from '@jest/globals';

import {
  HYDRATION_MAX_LITERS,
  HYDRATION_STEP_LITERS,
  formatHydrationLiters,
  isValidHydrationLiters,
  parseHydrationLiters,
} from '@/lib/format/hydration';

describe('hydration liters format', () => {
  describe('isValidHydrationLiters', () => {
    it('accepts positive in-range decimal strings', () => {
      expect(isValidHydrationLiters('0.25')).toBe(true);
      expect(isValidHydrationLiters('1.5')).toBe(true);
      expect(isValidHydrationLiters('2')).toBe(true);
      expect(isValidHydrationLiters(String(HYDRATION_MAX_LITERS))).toBe(true);
    });

    it('rejects zero, negatives, and out-of-range amounts', () => {
      expect(isValidHydrationLiters('0')).toBe(false);
      expect(isValidHydrationLiters('-1')).toBe(false);
      expect(isValidHydrationLiters(String(HYDRATION_MAX_LITERS + 1))).toBe(false);
    });

    it('rejects malformed, non-string, and empty values', () => {
      expect(isValidHydrationLiters('')).toBe(false);
      expect(isValidHydrationLiters('  ')).toBe(false);
      expect(isValidHydrationLiters('1.2.3')).toBe(false);
      expect(isValidHydrationLiters('abc')).toBe(false);
      expect(isValidHydrationLiters(1.5)).toBe(false);
      expect(isValidHydrationLiters(null)).toBe(false);
      expect(isValidHydrationLiters(undefined)).toBe(false);
    });
  });

  describe('parseHydrationLiters', () => {
    it('normalizes trailing zeros', () => {
      expect(parseHydrationLiters('1.50')).toBe('1.5');
      expect(parseHydrationLiters('2.00')).toBe('2');
      expect(parseHydrationLiters('0.25')).toBe('0.25');
    });

    it('throws on invalid amounts', () => {
      expect(() => parseHydrationLiters('0')).toThrow('Invalid hydration liters');
      expect(() => parseHydrationLiters('nope')).toThrow('Invalid hydration liters');
    });
  });

  describe('formatHydrationLiters', () => {
    it('renders es-AR liters with a comma decimal separator', () => {
      expect(formatHydrationLiters('1.5')).toBe('1,5 L');
      expect(formatHydrationLiters('2')).toBe('2 L');
      expect(formatHydrationLiters('0.25')).toBe('0,25 L');
    });

    it('throws on invalid amounts', () => {
      expect(() => formatHydrationLiters('0')).toThrow('Invalid hydration liters');
    });
  });

  it('exposes a 0.25 L step constant', () => {
    expect(HYDRATION_STEP_LITERS).toBe('0.25');
    expect(isValidHydrationLiters(HYDRATION_STEP_LITERS)).toBe(true);
  });
});
