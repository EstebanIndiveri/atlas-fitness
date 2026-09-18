import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ATLAS_COLOR, hexToRgb, hexToRgbCss } from './tokens';

describe('ATLAS_COLOR', () => {
  it('keeps PWA theme ink and a warm canvas (not utilitarian gray)', () => {
    expect(ATLAS_COLOR.ink).toBe('#0B1220');
    expect(ATLAS_COLOR.canvas).toBe('#F3EEE4');
    expect(ATLAS_COLOR.canvas.toLowerCase()).not.toBe('#f9fafb');
  });

  it('hexToRgbCss matches channel math', () => {
    expect(hexToRgb('#0B1220')).toEqual({ r: 11, g: 18, b: 32 });
    expect(hexToRgbCss(ATLAS_COLOR.ink)).toBe('rgb(11, 18, 32)');
    expect(hexToRgbCss(ATLAS_COLOR.canvas)).toBe('rgb(243, 238, 228)');
  });
});

describe('globals.css @theme', () => {
  const globalsCss = readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf8');

  it('declares Tailwind v4 @theme tokens matching ATLAS_COLOR', () => {
    expect(globalsCss).toMatch(/@theme\s*\{/);
    expect(globalsCss).toContain(`--color-ink: ${ATLAS_COLOR.ink}`);
    expect(globalsCss).toContain(`--color-canvas: ${ATLAS_COLOR.canvas}`);
    expect(globalsCss).toContain(`--color-brand: ${ATLAS_COLOR.brand}`);
    expect(globalsCss).toContain(`--color-surface: ${ATLAS_COLOR.surface}`);
    expect(globalsCss).toContain('--radius-md:');
    expect(globalsCss).toContain('--font-sans:');
  });
});
