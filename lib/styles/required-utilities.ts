/**
 * Utilities used on Must surfaces after HU-B tokens.
 * Tailwind must emit these from `@theme` + component/page class names.
 */
export const REQUIRED_APP_UTILITIES = [
  'bg-canvas',
  'bg-brand',
  'bg-surface',
  'text-ink',
  'text-brand-foreground',
  'rounded-md',
  'rounded-lg',
  'bg-warning-muted',
  'min-h-screen',
  'min-h-dvh',
  'shadow-card',
  'pt-safe',
  'pb-safe',
] as const;

export type RequiredAppUtility = (typeof REQUIRED_APP_UTILITIES)[number];

export function cssContainsUtility(css: string, className: string): boolean {
  return css.includes(`.${className}`);
}
