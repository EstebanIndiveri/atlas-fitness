/**
 * Atlas Fitness design tokens.
 *
 * CSS source of truth: `app/globals.css` `@theme`.
 * Keep hex values in sync; tests assert both sides.
 *
 * v0.13 adds semantic roles (action vs verified progress vs unknown) and
 * role-based shape/typography tokens. Primitives keep their literal values;
 * roles express intent so generic hues never encode domain facts.
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
  verified: '#0E6E68',
  verifiedMuted: '#D5EDEA',
  verifiedForeground: '#FFFFFF',
  unknown: '#4A5563',
  unknownMuted: '#ECE6DA',
  overlay: '#FFFFFF',
} as const;

/**
 * Semantic role → primitive mapping (brief §9–12).
 *
 * `action` is brand orientation; `verified` is the reserved progress accent;
 * `neutralHistory` reuses ink; `unknown` names insufficient evidence;
 * `panel`/`overlay` name surface depth. Declared so `brand !== every positive`.
 */
export const ATLAS_SEMANTIC_COLOR = {
  action: ATLAS_COLOR.brand,
  actionHover: ATLAS_COLOR.brandHover,
  actionForeground: ATLAS_COLOR.brandForeground,
  verified: ATLAS_COLOR.verified,
  verifiedMuted: ATLAS_COLOR.verifiedMuted,
  verifiedForeground: ATLAS_COLOR.verifiedForeground,
  neutralHistory: ATLAS_COLOR.inkMuted,
  unknown: ATLAS_COLOR.unknown,
  unknownMuted: ATLAS_COLOR.unknownMuted,
  warning: ATLAS_COLOR.warning,
  danger: ATLAS_COLOR.danger,
  canvas: ATLAS_COLOR.canvas,
  panel: ATLAS_COLOR.surface,
  overlay: ATLAS_COLOR.overlay,
} as const;

export const ATLAS_RADIUS = {
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  full: '9999px',
  /** Shape roles (brief §12). */
  control: '0.5rem',
  panel: '1.75rem',
  hero: '2rem',
  pill: '9999px',
} as const;

/** Computed px at 16px root — Playwright `toHaveCSS('border-radius')`. */
export const ATLAS_RADIUS_PX = {
  sm: '6px',
  md: '8px',
  lg: '12px',
  control: '8px',
  panel: '28px',
  hero: '32px',
} as const;

export const ATLAS_FONT = {
  sans: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  /** Editorial display role — same serif family already used via `font-serif`. */
  display: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif",
} as const;

/** Typography roles (brief §9). `numeric` pairs with the `numeric` utility. */
export const ATLAS_TEXT = {
  display: '2rem',
  title: '1.5rem',
  body: '1rem',
  caption: '0.875rem',
  numeric: '1.125rem',
} as const;

export type AtlasColorName = keyof typeof ATLAS_COLOR;
export type AtlasSemanticColorName = keyof typeof ATLAS_SEMANTIC_COLOR;

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
  verified: hexToRgbCss(ATLAS_COLOR.verified),
  verifiedForeground: hexToRgbCss(ATLAS_COLOR.verifiedForeground),
  unknown: hexToRgbCss(ATLAS_COLOR.unknown),
  overlay: hexToRgbCss(ATLAS_COLOR.overlay),
} as const;
