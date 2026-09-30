import { NextRequest } from 'next/server';

import { AppError } from '@/types/errors';

const POSITIVE_INT_RE = /^\d+$/;

/**
 * Parses the `[id]` workout route segment as a positive integer.
 *
 * @throws {AppError} VALIDATION when the segment is not a positive integer.
 */
export function parseWorkoutIdParam(value: string): number {
  return parsePositiveIntParam(value, 'ID de entrenamiento inválido');
}

/**
 * Parses the `[exerciseId]` route segment as a positive integer.
 *
 * @throws {AppError} VALIDATION when the segment is not a positive integer.
 */
export function parseExerciseIdParam(value: string): number {
  return parsePositiveIntParam(value, 'ID de ejercicio inválido');
}

function parsePositiveIntParam(value: string, message: string): number {
  if (!POSITIVE_INT_RE.test(value)) {
    throw new AppError('VALIDATION', message);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new AppError('VALIDATION', message);
  }

  return parsed;
}

/**
 * Reads a JSON object body, rejecting malformed JSON and non-object payloads.
 *
 * @throws {AppError} VALIDATION when the body is not a JSON object.
 */
export async function parseJsonObject(request: NextRequest): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError('VALIDATION', 'Body JSON inválido');
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError('VALIDATION', 'Body JSON inválido');
  }

  return { ...body };
}
