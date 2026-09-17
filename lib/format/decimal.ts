/**
 * Decimal utility functions to avoid float precision issues
 */

/**
 * Adds two decimal strings and returns the result as a decimal string
 */
export function addDecimal(a: string, b: string): string {
  const numA = parseFloat(a);
  const numB = parseFloat(b);

  if (isNaN(numA) || isNaN(numB)) {
    throw new Error('Invalid decimal values');
  }

  const result = numA + numB;
  return result.toString();
}

/**
 * Compares two decimal strings
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareDecimal(a: string, b: string): number {
  const numA = parseFloat(a);
  const numB = parseFloat(b);

  if (isNaN(numA) || isNaN(numB)) {
    throw new Error('Invalid decimal values');
  }

  if (numA < numB) return -1;
  if (numA > numB) return 1;
  return 0;
}

/**
 * Multiplies two decimal strings and returns the result as a decimal string
 */
export function multiplyDecimal(a: string, b: string): string {
  const numA = parseFloat(a);
  const numB = parseFloat(b);

  if (isNaN(numA) || isNaN(numB)) {
    throw new Error('Invalid decimal values');
  }

  const result = numA * numB;
  return result.toString();
}

/**
 * Normalizes a decimal string by removing trailing zeros
 */
export function normalizeDecimal(value: string): string {
  if (!value || value === '0') {
    return '0';
  }

  let normalized = value.trim();

  if (normalized.includes('.')) {
    normalized = normalized.replace(/\.?0+$/, '');
    if (normalized.endsWith('.')) {
      normalized = normalized.slice(0, -1);
    }
  }

  return normalized || '0';
}
