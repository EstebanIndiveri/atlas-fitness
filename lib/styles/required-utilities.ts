/**
 * Utilities used on Must surfaces: home, login, dashboard, active workout, InstallBanner.
 * The Tailwind pipeline must emit these; do not treat this list as a design-token system.
 */
export const REQUIRED_APP_UTILITIES = [
  'bg-slate-900',
  'bg-gray-50',
  'rounded-md',
  'text-white',
  'bg-amber-50',
  'bg-amber-700',
  'border-amber-200',
  'bg-blue-600',
  'shadow-md',
  'min-h-screen',
] as const;

export type RequiredAppUtility = (typeof REQUIRED_APP_UTILITIES)[number];

export function cssContainsUtility(css: string, className: string): boolean {
  return css.includes(`.${className}`);
}
