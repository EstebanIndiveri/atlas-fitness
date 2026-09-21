import { AppError } from '@/types/errors';

export const MEDIA_URL_MAX_LENGTH = 2048;

export const MEDIA_URL_SCHEME_MESSAGE = 'La URL de media debe usar https://';
export const MEDIA_URL_LENGTH_MESSAGE = 'La URL de media no puede superar 2048 caracteres';

/** Returns true when a media URL is https://, has a host and fits the DB limit. */
export function isValidMediaUrl(value: string): boolean {
  if (value.length > MEDIA_URL_MAX_LENGTH) {
    return false;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

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

  if (!isValidMediaUrl(trimmed)) {
    throw new AppError('VALIDATION', MEDIA_URL_SCHEME_MESSAGE);
  }

  return trimmed;
}
