import type { WeightKg } from '@/types/weight';

/**
 * Validates if a string represents a valid weight in kg.
 * Valid weights are positive numbers up to 999.99 kg.
 */
export function isValidWeightKg(weight: string): boolean {
  if (!weight || typeof weight !== 'string') {
    return false;
  }

  const num = parseFloat(weight);
  if (isNaN(num) || num <= 0 || num >= 1000) {
    return false;
  }

  // Check that it's a valid decimal string format
  if (!/^\d+\.?\d*$/.test(weight)) {
    return false;
  }

  return true;
}

/**
 * Parses and normalizes a weight string, removing trailing zeros.
 * Returns a normalized decimal string representation.
 * Throws if the weight is invalid.
 */
export function parseWeightKg(weight: string): WeightKg {
  if (!isValidWeightKg(weight)) {
    throw new Error(`Invalid weight: ${weight}`);
  }

  const num = parseFloat(weight);
  // Convert to string and remove unnecessary trailing zeros
  return num.toString();
}

/**
 * Formats a weight value for display with unit "kg".
 * Ensures at least one decimal place for readability.
 * Throws if the weight is invalid.
 */
export function formatWeightKg(weight: WeightKg): string {
  if (!isValidWeightKg(weight)) {
    throw new Error(`Invalid weight: ${weight}`);
  }

  const parsed = parseWeightKg(weight);
  const num = parseFloat(parsed);

  // Format with at least one decimal place
  const formatted = num % 1 === 0 ? num.toFixed(1) : parsed;

  return `${formatted} kg`;
}
