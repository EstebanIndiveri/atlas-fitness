import { AppError } from '@/types/errors';

export const MEDIA_URL_MAX_LENGTH = 2048;

export const MEDIA_URL_SCHEME_MESSAGE = 'La URL de media debe usar https://';
export const MEDIA_URL_LENGTH_MESSAGE = 'La URL de media no puede superar 2048 caracteres';

/**
 * Normalizes optional media URLs for custom exercises.
 * Null/empty clears the field. Non-empty values must be https:// and ≤ 2048 chars.
 */
export function normalizeMediaUrl(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length > MEDIA_URL_MAX_LENGTH) {
    throw new AppError('VALIDATION', MEDIA_URL_LENGTH_MESSAGE);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new AppError('VALIDATION', MEDIA_URL_SCHEME_MESSAGE);
  }

  if (parsed.protocol !== 'https:' || !parsed.hostname) {
    throw new AppError('VALIDATION', MEDIA_URL_SCHEME_MESSAGE);
  }

  return trimmed;
}
