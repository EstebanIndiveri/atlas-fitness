import { MEDIA_URL_MAX_LENGTH, isValidMediaUrl } from '@/lib/validation/media-url';

export { MEDIA_URL_MAX_LENGTH };

/** Client scheme gate for catalog media URLs. */
export function isHttpsMediaUrl(value: string): boolean {
  return isValidMediaUrl(value);
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

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'm.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);
const VIDEO_FILE_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.m4v'];

function isValidYoutubeId(id: string): boolean {
  return /^[A-Za-z0-9_-]{11}$/.test(id);
}

/**
 * Extracts a YouTube video id from watch, youtu.be, embed or shorts URLs.
 * Returns null for search-result pages, other providers and malformed ids.
 */
export function youtubeVideoId(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1);
    return isValidYoutubeId(id) ? id : null;
  }
  if (host === 'youtube.com' || YOUTUBE_HOSTS.has(url.hostname)) {
    if (url.pathname === '/watch') {
      const id = url.searchParams.get('v');
      return id && isValidYoutubeId(id) ? id : null;
    }
    const match = url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/);
    if (match) {
      return isValidYoutubeId(match[1]) ? match[1] : null;
    }
  }
  return null;
}

function isVideoFileUrl(value: string): boolean {
  try {
    const path = new URL(value).pathname.toLowerCase();
    return VIDEO_FILE_EXTENSIONS.some((ext) => path.endsWith(ext));
  } catch {
    return false;
  }
}

/** In-app playable video descriptor: an embedded YouTube player or a direct file. */
export type ResolvedExerciseVideo =
  | { kind: 'youtube'; embedUrl: string; watchUrl: string }
  | { kind: 'file'; src: string };

/**
 * Resolves a stored video URL into an in-app playable descriptor.
 * YouTube links become privacy-friendly embeds; direct files play inline.
 * Returns null for missing, unsafe (non-https/over-length), search-result or
 * otherwise unsupported URLs, so callers render an empty state instead of a broken link.
 */
export function resolvedExerciseVideo(
  value: string | null | undefined,
): ResolvedExerciseVideo | null {
  const safe = resolvedMediaUrl(value);
  if (!safe) {
    return null;
  }
  const youtubeId = youtubeVideoId(safe);
  if (youtubeId) {
    return {
      kind: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}`,
      watchUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
    };
  }
  if (isVideoFileUrl(safe)) {
    return { kind: 'file', src: safe };
  }
  return null;
}
