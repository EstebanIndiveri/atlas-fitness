import { describe, expect, it } from '@jest/globals';
import { cssColorsMatch, parseCssColor } from './css-color';

describe('parseCssColor', () => {
  it('parses comma-separated rgb', () => {
    expect(parseCssColor('rgb(15, 23, 42)')).toEqual({ r: 15, g: 23, b: 42 });
  });

  it('parses space-separated rgb', () => {
    expect(parseCssColor('rgb(249 250 251)')).toEqual({ r: 249, g: 250, b: 251 });
  });

  it('parses Chromium lab() for slate-900', () => {
    const parsed = parseCssColor('lab(7.78673 1.82345 -15.0537)');
    expect(parsed).not.toBeNull();
    expect(parsed?.r).toBeGreaterThanOrEqual(13);
    expect(parsed?.r).toBeLessThanOrEqual(17);
    expect(parsed?.g).toBeGreaterThanOrEqual(21);
    expect(parsed?.g).toBeLessThanOrEqual(25);
    expect(parsed?.b).toBeGreaterThanOrEqual(40);
    expect(parsed?.b).toBeLessThanOrEqual(44);
  });

  it('returns null for unknown syntax', () => {
    expect(parseCssColor('transparent')).toBeNull();
  });
});

describe('cssColorsMatch', () => {
  it('matches identical rgb strings', () => {
    expect(cssColorsMatch('rgb(15, 23, 42)', 'rgb(15, 23, 42)')).toBe(true);
  });

  it('matches CI Chromium lab() for slate-900', () => {
    expect(cssColorsMatch('lab(7.78673 1.82345 -15.0537)', 'rgb(15, 23, 42)')).toBe(true);
  });

  it('matches CI Chromium lab() for gray-50', () => {
    expect(cssColorsMatch('lab(98.2596 -0.247031 -0.706708)', 'rgb(249, 250, 251)')).toBe(
      true,
    );
  });

  it('matches lab() white against rgb white', () => {
    expect(cssColorsMatch('lab(100 0 0)', 'rgb(255, 255, 255)')).toBe(true);
  });

  it('rejects a different color', () => {
    expect(cssColorsMatch('lab(7.78673 1.82345 -15.0537)', 'rgb(249, 250, 251)')).toBe(
      false,
    );
  });
});
