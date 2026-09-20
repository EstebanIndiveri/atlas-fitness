import { describe, it, expect } from '@jest/globals';
import { formatWeightKg, parseWeightKg, isValidWeightKg } from './weight';

describe('formatWeightKg', () => {
  it('should format integer weight with one decimal place', () => {
    expect(formatWeightKg('100')).toBe('100.0 kg');
    expect(formatWeightKg('80')).toBe('80.0 kg');
  });

  it('should format decimal weight correctly', () => {
    expect(formatWeightKg('80.5')).toBe('80.5 kg');
    expect(formatWeightKg('62.75')).toBe('62.75 kg');
    expect(formatWeightKg('100.25')).toBe('100.25 kg');
  });

  it('should handle trailing zeros', () => {
    expect(formatWeightKg('80.50')).toBe('80.5 kg');
    expect(formatWeightKg('100.00')).toBe('100.0 kg');
  });

  it('should throw on invalid input', () => {
    expect(() => formatWeightKg('abc')).toThrow();
    expect(() => formatWeightKg('')).toThrow();
    expect(() => formatWeightKg('-10')).toThrow();
  });
});

describe('parseWeightKg', () => {
  it('should parse valid weight strings', () => {
    expect(parseWeightKg('80')).toBe('80');
    expect(parseWeightKg('80.5')).toBe('80.5');
    expect(parseWeightKg('100.25')).toBe('100.25');
  });

  it('should normalize weight strings', () => {
    expect(parseWeightKg('80.50')).toBe('80.5');
    expect(parseWeightKg('100.00')).toBe('100');
  });

  it('should throw on invalid input', () => {
    expect(() => parseWeightKg('abc')).toThrow();
    expect(() => parseWeightKg('')).toThrow();
    expect(() => parseWeightKg('-10')).toThrow();
  });
});

describe('isValidWeightKg', () => {
  it('should return true for valid weights', () => {
    expect(isValidWeightKg('80')).toBe(true);
    expect(isValidWeightKg('80.5')).toBe(true);
    expect(isValidWeightKg('100.25')).toBe(true);
    expect(isValidWeightKg('0.5')).toBe(true);
  });

  it('should return false for invalid weights', () => {
    expect(isValidWeightKg('abc')).toBe(false);
    expect(isValidWeightKg('')).toBe(false);
    expect(isValidWeightKg('-10')).toBe(false);
    expect(isValidWeightKg('1000000')).toBe(false); // unrealistic weight
  });

  it('should return false for zero or negative', () => {
    expect(isValidWeightKg('0')).toBe(false);
    expect(isValidWeightKg('-5')).toBe(false);
  });
});
