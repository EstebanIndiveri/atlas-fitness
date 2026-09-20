import { z } from 'zod';

import { coachAdaptationResultSchema } from '@/lib/ai/coach/adaptation';
import { AppError } from '@/types/errors';
import type { CoachAdaptationResult } from '@/types/coach';

const jsonValueSchema = z.json();

export function serializeJsonValue(value: unknown): string {
  const parsed = jsonValueSchema.safeParse(value);
  if (!parsed.success) throw new AppError('VALIDATION', 'Recomendación inválida');

  try {
    const serialized = JSON.stringify(parsed.data);
    if (serialized === undefined) throw new AppError('VALIDATION', 'Recomendación inválida');
    return serialized;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('VALIDATION', 'Recomendación inválida');
  }
}

export function parseJsonValue(value: string | null): unknown | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    const result = jsonValueSchema.safeParse(parsed);
    if (!result.success) throw new AppError('VALIDATION', 'Recomendación inválida');
    return result.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('VALIDATION', 'Recomendación inválida');
  }
}

export function parseCoachResultJson(value: string): CoachAdaptationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new AppError('VALIDATION', 'Recomendación inválida');
  }
  const result = coachAdaptationResultSchema.safeParse(parsed);
  if (!result.success) throw new AppError('VALIDATION', 'Recomendación inválida');
  return result.data;
}
