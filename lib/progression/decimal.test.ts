import { describe, expect, it } from '@jest/globals';
import {
  compareExactDecimal,
  isCanonicalPositiveDecimal,
  isZeroDecimal,
  normalizeExactDecimal,
} from './decimal';

describe('isCanonicalPositiveDecimal', () => {
  it('accepts canonical positive decimals', () => {
    for (const value of ['1', '0.5', '80.5', '100', '1.01', '0.001', '12.345', '0.000001']) {
      expect(isCanonicalPositiveDecimal(value)).toBe(true);
    }
  });

  it('rejects zero, negative, malformed and non-canonical forms', () => {
    const rejected = [
      '0',
      '0.0',
      '0.00',
      '00',
      '00.00',
      '01',
      '1.0',
      '1.10',
      '80.50',
      '10.00',
      '.5',
      '1.',
      '',
      'abc',
      '-1',
      '-0.5',
      '1e3',
      ' 1',
      '1 ',
      '1,5',
      '1.2.3',
    ];
    for (const value of rejected) {
      expect(isCanonicalPositiveDecimal(value)).toBe(false);
    }
  });
});

describe('isZeroDecimal', () => {
  it('accepts every canonical representation of zero', () => {
    for (const value of ['0', '0.0', '0.00', '00', '000', '000.000']) {
      expect(isZeroDecimal(value)).toBe(true);
    }
  });

  it('rejects non-zero or malformed values', () => {
    for (const value of ['0.01', '1', '', 'abc', '-0', '-0.0', '0.5', '1.0', '.0', '0.']) {
      expect(isZeroDecimal(value)).toBe(false);
    }
  });
});

describe('normalizeExactDecimal', () => {
  it('strips redundant leading integer zeros and trailing fractional zeros', () => {
    expect(normalizeExactDecimal('080.50')).toBe('80.5');
    expect(normalizeExactDecimal('1.10')).toBe('1.1');
    expect(normalizeExactDecimal('0.00')).toBe('0');
    expect(normalizeExactDecimal('100')).toBe('100');
    expect(normalizeExactDecimal('007')).toBe('7');
    expect(normalizeExactDecimal('0.500')).toBe('0.5');
    expect(normalizeExactDecimal('10.0100')).toBe('10.01');
    expect(normalizeExactDecimal('000.000')).toBe('0');
  });

  it('is idempotent for already canonical values', () => {
    for (const value of ['0', '1', '80.5', '1.01', '0.001']) {
      expect(normalizeExactDecimal(value)).toBe(value);
    }
  });

  it('handles an explicit negative sign and negative zero', () => {
    expect(normalizeExactDecimal('-1.10')).toBe('-1.1');
    expect(normalizeExactDecimal('-0.00')).toBe('0');
  });

  it('throws on malformed input instead of guessing', () => {
    for (const value of ['', 'abc', '1.', '.5', '1..2', '1e3', ' 1', '1 ', '1,5', '--1', '+1']) {
      expect(() => normalizeExactDecimal(value)).toThrow();
    }
  });
});

describe('compareExactDecimal', () => {
  it('compares by exact numeric value, not lexicographically', () => {
    expect(compareExactDecimal('1.1', '1.01')).toBe(1);
    expect(compareExactDecimal('1.01', '1.1')).toBe(-1);
    expect(compareExactDecimal('9.9', '10')).toBe(-1);
    expect(compareExactDecimal('100', '99.99')).toBe(1);
    expect(compareExactDecimal('0.001', '0.0009')).toBe(1);
    expect(compareExactDecimal('2', '10')).toBe(-1);
  });

  it('compares integer parts by digit length before lexicographic order', () => {
    expect(compareExactDecimal('1000', '999')).toBe(1);
    expect(compareExactDecimal('999', '1000')).toBe(-1);
  });

  it('treats equal values with different precision as equal', () => {
    expect(compareExactDecimal('1.10', '1.1')).toBe(0);
    expect(compareExactDecimal('1.0', '1')).toBe(0);
    expect(compareExactDecimal('0.5', '0.50')).toBe(0);
    expect(compareExactDecimal('0', '0.00')).toBe(0);
    expect(compareExactDecimal('100', '100.000')).toBe(0);
  });

  it('handles zero and variable precision', () => {
    expect(compareExactDecimal('0', '0.01')).toBe(-1);
    expect(compareExactDecimal('0.01', '0')).toBe(1);
    expect(compareExactDecimal('0.10', '0.1')).toBe(0);
    expect(compareExactDecimal('0.001', '0.0010')).toBe(0);
  });

  it('is sign-aware', () => {
    expect(compareExactDecimal('-1', '1')).toBe(-1);
    expect(compareExactDecimal('1', '-1')).toBe(1);
    expect(compareExactDecimal('-2', '-1')).toBe(-1);
    expect(compareExactDecimal('-1', '-1.0')).toBe(0);
    expect(compareExactDecimal('-0.5', '-0.50')).toBe(0);
    expect(compareExactDecimal('-0.001', '-0.0009')).toBe(-1);
  });

  it('throws on malformed input instead of guessing', () => {
    for (const value of ['', 'abc', '1.', '.5', '1e3', ' 1', '1 ', '1,5']) {
      expect(() => compareExactDecimal(value, '1')).toThrow();
      expect(() => compareExactDecimal('1', value)).toThrow();
    }
  });
});
