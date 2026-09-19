export function resolvedMediaUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Client scheme gate for catalog media URLs.
 * Length (2048) is owned by BE `normalizeMediaUrl` — do not duplicate here.
 */
export function isHttpsMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch {
    return false;
  }
}
