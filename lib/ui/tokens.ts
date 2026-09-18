/**
 * Atlas Fitness design tokens (HU-B).
 * CSS source of truth: `app/globals.css` `@theme`.
 * Keep hex values in sync; tests assert both sides.
 */

export const ATLAS_COLOR = {
  ink: '#0B1220',
  inkMuted: '#445064',
  canvas: '#F3EEE4',
  surface: '#FFFDF8',
  line: '#D9D1C3',
  brand: '#1F6B4A',
  brandHover: '#17563B',
  brandMuted: '#D7EDE3',
  brandForeground: '#FFFFFF',
  danger: '#B42318',
  dangerMuted: '#FCEBEA',
  dangerForeground: '#FFFFFF',
  success: '#1F6B4A',
  successForeground: '#FFFFFF',
  warning: '#9A3412',
  warningMuted: '#FEF3C7',
  warningForeground: '#FFFFFF',
} as const;

export const ATLAS_RADIUS = {
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  full: '9999px',
} as const;

export const ATLAS_FONT = {
  sans: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
} as const;

export type AtlasColorName = keyof typeof ATLAS_COLOR;

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

export function hexToRgbCss(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${r}, ${g}, ${b})`;
}

export const ATLAS_COLOR_RGB = {
  ink: hexToRgbCss(ATLAS_COLOR.ink),
  inkMuted: hexToRgbCss(ATLAS_COLOR.inkMuted),
  canvas: hexToRgbCss(ATLAS_COLOR.canvas),
  surface: hexToRgbCss(ATLAS_COLOR.surface),
  brand: hexToRgbCss(ATLAS_COLOR.brand),
  brandForeground: hexToRgbCss(ATLAS_COLOR.brandForeground),
} as const;
