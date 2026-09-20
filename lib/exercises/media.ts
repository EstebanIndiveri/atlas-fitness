import { MEDIA_URL_MAX_LENGTH } from '@/lib/validation/media-url';

export { MEDIA_URL_MAX_LENGTH };

/** Client scheme gate for catalog media URLs. */
export function isHttpsMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Client scheme + length gate. Mirrors BE `normalizeMediaUrl` (https + ≤2048).
 */
export function isValidClientMediaUrl(value: string): boolean {
  if (value.length > MEDIA_URL_MAX_LENGTH) {
    return false;
  }
  return isHttpsMediaUrl(value);
}

/** Preview/link helper: only https URLs ≤2048; otherwise treat as missing. */
export function resolvedMediaUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || !isValidClientMediaUrl(trimmed)) {
    return null;
  }
  return trimmed;
}
