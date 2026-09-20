/**
 * Hydration is tracked as liters entered by the user (source: user_input).
 *
 * Amounts are stored and compared as decimal strings to avoid float precision
 * drift (same convention as weight_kg). Atlas never fabricates a hydration
 * target or a completion ratio; it only echoes the real amount the user logged
 * (DATA HONESTY RULE).
 */

/** Maximum plausible daily hydration in liters (guards absurd input / DoS). */
export const HYDRATION_MAX_LITERS = 20;

/** Increment used by the quantitative hydration stepper, in liters. */
export const HYDRATION_STEP_LITERS = '0.25';

/**
 * Validates a decimal string as a hydration amount in liters.
 *
 * Valid amounts are strictly positive and at most {@link HYDRATION_MAX_LITERS}.
 * @param liters - Candidate decimal string from an untrusted boundary.
 * @returns True when the value is a well-formed, in-range liters amount.
 * @example
 * isValidHydrationLiters('1.5'); // true
 */
export function isValidHydrationLiters(liters: unknown): liters is string {
  if (typeof liters !== 'string' || liters.trim() === '') {
    return false;
  }

  if (!/^\d+(\.\d+)?$/.test(liters.trim())) {
    return false;
  }

  const num = Number.parseFloat(liters);
  return Number.isFinite(num) && num > 0 && num <= HYDRATION_MAX_LITERS;
}

/**
 * Parses and normalizes a hydration liters string, removing trailing zeros.
 *
 * @param liters - Decimal string to normalize.
 * @returns Normalized decimal string (e.g. `'1.50'` -> `'1.5'`).
 * @throws {Error} When the value is not a valid hydration amount.
 * @example
 * parseHydrationLiters('1.50'); // '1.5'
 */
export function parseHydrationLiters(liters: string): string {
  if (!isValidHydrationLiters(liters)) {
    throw new Error(`Invalid hydration liters: ${liters}`);
  }

  let normalized = liters.trim();

  if (normalized.includes('.')) {
    normalized = normalized.replace(/\.?0+$/, '');
    if (normalized.endsWith('.')) {
      normalized = normalized.slice(0, -1);
    }
  }

  return normalized || '0';
}

/**
 * Formats a hydration amount for display in es-AR liters.
 *
 * @param liters - Valid hydration decimal string.
 * @returns Display string such as `'1,5 L'`.
 * @throws {Error} When the value is not a valid hydration amount.
 * @example
 * formatHydrationLiters('1.5'); // '1,5 L'
 */
export function formatHydrationLiters(liters: string): string {
  const parsed = parseHydrationLiters(liters);
  const num = Number.parseFloat(parsed);
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);

  return `${formatted} L`;
}
