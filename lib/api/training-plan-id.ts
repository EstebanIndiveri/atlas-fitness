import { AppError } from '@/types/errors';

/**
 * Parses a positive safe-integer training-plan route parameter.
 *
 * @param value - Raw dynamic route segment.
 * @returns The validated plan id.
 * @throws {AppError} VALIDATION when the segment is not a positive safe integer.
 * @example
 * parseTrainingPlanId('12');
 */
export function parseTrainingPlanId(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new AppError('VALIDATION', 'ID de plan inválido');
  }

  const planId = Number(value);
  if (!Number.isSafeInteger(planId)) {
    throw new AppError('VALIDATION', 'ID de plan inválido');
  }

  return planId;
}
