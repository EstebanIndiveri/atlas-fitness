/**
 * YouTube oEmbed validation for exercise videos.
 *
 * Before persisting an AI/curated video we confirm it actually exists and is
 * embeddable (oEmbed returns HTTP 200) and that its title matches the exercise,
 * so we never store a dead link or the wrong clip.
 *
 * @see https://oembed.com and https://www.youtube.com/oembed
 */

import { youtubeVideoId } from '@/lib/exercises/media';

export type OembedResponse = {
  status: number;
  json: unknown;
};

/** Injected oEmbed fetcher (returns HTTP status + parsed body) to keep this pure/testable. */
export type OembedFetch = (oembedUrl: string) => Promise<OembedResponse>;

export type ValidatedYoutubeVideo = {
  watchUrl: string;
  title: string;
  author: string | null;
};

function oembedUrlFor(videoId: string): string {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  return `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
}

/**
 * Structural stopwords plus generic gym vocabulary that, on their own, do not
 * identify a specific movement. A title sharing ONLY these with the exercise
 * (e.g. "leg press" vs "bench press") must not count as a match.
 */
const GENERIC_TITLE_TOKENS = new Set([
  // structural (es/en)
  'de', 'la', 'el', 'los', 'las', 'con', 'para', 'por', 'del', 'the', 'a', 'an',
  'to', 'of', 'for', 'how', 'your', 'you', 'and', 'que', 'como', 'en', 'un', 'una',
  // generic gym words
  'press', 'barbell', 'dumbbell', 'barra', 'mancuerna', 'machine', 'maquina',
  'peso', 'pesa', 'pesas', 'weight',
  'ejercicio', 'exercise', 'gym', 'fitness', 'workout', 'rutina', 'full', 'body',
  'tecnica', 'technique', 'tutorial', 'correcta', 'correcto', 'perfecta', 'perfecto',
  'form', 'guide', 'guia', 'over',
]);

/** Accent/case-normalized significant tokens (length ≥ 3, minus generic words). */
function significantTokens(value: string): Set<string> {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');
  return new Set(
    normalized
      .split(' ')
      .filter((token) => token.length >= 3 && !GENERIC_TITLE_TOKENS.has(token)),
  );
}

/**
 * Returns true when the video title shares at least one *distinctive* token with
 * the exercise keywords (generic gym words are ignored), guarding against
 * confidently-wrong AI suggestions while accepting real titles that omit the full
 * stored phrase (e.g. "The Bench Press" for "barbell bench press"). Accent/case-insensitive.
 */
export function titleMatchesExercise(title: string, keywords: string[]): boolean {
  const titleTokens = significantTokens(title);
  if (titleTokens.size === 0) {
    return false;
  }
  for (const keyword of keywords) {
    for (const token of significantTokens(keyword)) {
      if (titleTokens.has(token)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Validates a YouTube URL via oEmbed. Resolves to the canonical watch URL + title
 * when the video exists and (if keywords are provided) its title matches; otherwise null.
 *
 * @param url Any YouTube watch/short/embed URL.
 * @param deps Injected `fetchOembed`.
 * @param keywords Optional exercise keywords the title must contain.
 */
export async function validateYoutubeVideo(
  url: string,
  deps: { fetchOembed: OembedFetch },
  keywords: string[] = [],
): Promise<ValidatedYoutubeVideo | null> {
  const videoId = youtubeVideoId(url);
  if (!videoId) {
    return null;
  }

  let response: OembedResponse;
  try {
    response = await deps.fetchOembed(oembedUrlFor(videoId));
  } catch {
    return null;
  }

  if (response.status !== 200 || typeof response.json !== 'object' || response.json === null) {
    return null;
  }
  const body = response.json as Record<string, unknown>;
  const title = typeof body.title === 'string' ? body.title : null;
  if (!title) {
    return null;
  }
  if (keywords.length > 0 && !titleMatchesExercise(title, keywords)) {
    return null;
  }

  return {
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    title,
    author: typeof body.author_name === 'string' ? body.author_name : null,
  };
}
