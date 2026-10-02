import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  ATLAS_COLOR,
  ATLAS_FONT,
  ATLAS_RADIUS,
  ATLAS_RADIUS_PX,
  ATLAS_SEMANTIC_COLOR,
  ATLAS_TEXT,
  hexToRgb,
  hexToRgbCss,
} from './tokens';
import { PWA_THEME } from '@/lib/pwa/theme';

const globalsCss = readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf8');

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** Reads a custom-property value from the compiled source, ignoring declaration order. */
function cssVar(name: string): string | undefined {
  return globalsCss.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim();
}

/** Quote/whitespace-insensitive compare for font stacks declared in CSS vs TS. */
function normalizeFontStack(value: string): string {
  return value.replace(/["']/g, '').replace(/\s+/g, ' ').trim();
}

describe('ATLAS_COLOR', () => {
  it('keeps PWA theme ink and a warm canvas (not utilitarian gray)', () => {
    expect(ATLAS_COLOR.ink).toBe('#0B1220');
    expect(ATLAS_COLOR.canvas).toBe('#F3EEE4');
    expect(ATLAS_COLOR.canvas.toLowerCase()).not.toBe('#f9fafb');
    expect(PWA_THEME.themeColor).toBe(ATLAS_COLOR.ink);
    expect(PWA_THEME.backgroundColor).toBe(ATLAS_COLOR.canvas);
  });

  it('hexToRgbCss matches channel math', () => {
    expect(hexToRgb('#0B1220')).toEqual({ r: 11, g: 18, b: 32 });
    expect(hexToRgbCss(ATLAS_COLOR.ink)).toBe('rgb(11, 18, 32)');
    expect(hexToRgbCss(ATLAS_COLOR.canvas)).toBe('rgb(243, 238, 228)');
  });
});

describe('ATLAS_SEMANTIC_COLOR roles (brief §9–12)', () => {
  it('keeps action and verified progress as distinct roles', () => {
    expect(ATLAS_SEMANTIC_COLOR.action).toBe(ATLAS_COLOR.brand);
    expect(ATLAS_SEMANTIC_COLOR.verified).toBe(ATLAS_COLOR.verified);
    expect(ATLAS_SEMANTIC_COLOR.verified).not.toBe(ATLAS_SEMANTIC_COLOR.action);
    expect(ATLAS_SEMANTIC_COLOR.verified).not.toBe(ATLAS_COLOR.success);
  });

  it('names history, unknown evidence and surface depth without inventing facts', () => {
    expect(ATLAS_SEMANTIC_COLOR.neutralHistory).toBe(ATLAS_COLOR.inkMuted);
    expect(ATLAS_SEMANTIC_COLOR.unknown).toBe(ATLAS_COLOR.unknown);
    expect(ATLAS_SEMANTIC_COLOR.unknownMuted).toBe(ATLAS_COLOR.unknownMuted);
    expect(ATLAS_SEMANTIC_COLOR.canvas).toBe(ATLAS_COLOR.canvas);
    expect(ATLAS_SEMANTIC_COLOR.panel).toBe(ATLAS_COLOR.surface);
    expect(ATLAS_SEMANTIC_COLOR.overlay).toBe(ATLAS_COLOR.overlay);
  });
});

describe('ATLAS_RADIUS shape roles (brief §12)', () => {
  it('exposes control, panel, hero and pill roles', () => {
    expect(ATLAS_RADIUS.control).toBe('0.5rem');
    expect(ATLAS_RADIUS.panel).toBe('1.75rem');
    expect(ATLAS_RADIUS.hero).toBe('2rem');
    expect(ATLAS_RADIUS.pill).toBe('9999px');
  });

  it('maps roles to computed px for rendered assertions', () => {
    expect(ATLAS_RADIUS_PX.control).toBe('8px');
    expect(ATLAS_RADIUS_PX.panel).toBe('28px');
    expect(ATLAS_RADIUS_PX.hero).toBe('32px');
  });
});

describe('ATLAS typography roles (brief §9)', () => {
  it('keeps existing font families and adds an editorial serif role', () => {
    expect(ATLAS_FONT.display).toContain('serif');
    expect(ATLAS_FONT.display).not.toBe(ATLAS_FONT.sans);
  });

  it('declares the numeric size used by the tabular data role', () => {
    expect(ATLAS_TEXT.numeric).toBe('1.125rem');
  });
});

describe('globals.css @theme', () => {
  it('declares Tailwind v4 @theme tokens matching ATLAS_COLOR', () => {
    expect(globalsCss).toMatch(/@theme\s*\{/);
    expect(globalsCss).toContain(`--color-ink: ${ATLAS_COLOR.ink}`);
    expect(globalsCss).toContain(`--color-canvas: ${ATLAS_COLOR.canvas}`);
    expect(globalsCss).toContain(`--color-brand: ${ATLAS_COLOR.brand}`);
    expect(globalsCss).toContain(`--color-surface: ${ATLAS_COLOR.surface}`);
    expect(globalsCss).toContain('--radius-md:');
    expect(globalsCss).toContain('--font-sans:');
    expect(globalsCss).toContain('@utility pt-safe');
    expect(globalsCss).toContain('prefers-reduced-motion: reduce');
    // v0.13 workstream C retired the replayable streak pop in favour of the
    // purpose-driven motion grammar asserted in lib/ui/motion.test.ts.
    expect(globalsCss).not.toContain('.streak-pop');
  });

  it('mirrors every color primitive so the two sources cannot drift', () => {
    for (const [name, value] of Object.entries(ATLAS_COLOR)) {
      expect(globalsCss).toContain(`--color-${kebab(name)}: ${value}`);
    }
  });

  it('mirrors shape, numeric and display role values so CSS and TS cannot drift', () => {
    expect(cssVar('radius-control')).toBe(ATLAS_RADIUS.control);
    expect(cssVar('radius-panel')).toBe(ATLAS_RADIUS.panel);
    expect(cssVar('radius-hero')).toBe(ATLAS_RADIUS.hero);
    expect(cssVar('radius-pill')).toBe(ATLAS_RADIUS.pill);
    expect(cssVar('text-numeric')).toBe(ATLAS_TEXT.numeric);
    expect(normalizeFontStack(cssVar('font-display') ?? '')).toBe(
      normalizeFontStack(ATLAS_FONT.display),
    );
  });

  it('declares the new shape, typography and depth role tokens', () => {
    expect(globalsCss).toContain('--radius-control:');
    expect(globalsCss).toContain('--radius-panel:');
    expect(globalsCss).toContain('--radius-hero:');
    expect(globalsCss).toContain('--radius-pill:');
    expect(globalsCss).toContain('--shadow-overlay:');
    expect(globalsCss).toContain('--font-display:');
    expect(globalsCss).toContain('--text-numeric:');
  });

  it('scans lib/ui so role classes are emitted before components consume them', () => {
    expect(globalsCss).toContain('@source "../lib/ui"');
  });

  it('defines the numeric utility with truthful tabular alignment', () => {
    expect(globalsCss).toMatch(/@utility\s+numeric\s*\{/);
    expect(globalsCss).toContain('font-variant-numeric: tabular-nums');
  });
});
