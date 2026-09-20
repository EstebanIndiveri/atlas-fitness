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
 * Returns true when the video title shares at least one keyword with the exercise,
 * guarding against confidently-wrong AI suggestions. Keywords are normalized/accent-free.
 */
export function titleMatchesExercise(title: string, keywords: string[]): boolean {
  const normalizedTitle = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return keywords.some((keyword) => {
    const normalized = keyword
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    return normalized.length > 0 && normalizedTitle.includes(normalized);
  });
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
