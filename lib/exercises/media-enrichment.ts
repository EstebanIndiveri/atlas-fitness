import { resolvedExerciseVideo, resolvedMediaUrl } from '@/lib/exercises/media';
import type { CatalogImageMatch } from '@/lib/exercises/catalog/free-exercise-db';
import type { ValidatedYoutubeVideo } from '@/lib/exercises/video-oembed';

/**
 * Deterministic media enrichment for exercises.
 *
 * Fills missing image/video WITHOUT manual uploads:
 * - image: reuse a valid existing image, else the free-exercise-db catalog match.
 * - video: reuse a valid in-app-playable video, else a Gemini-suggested YouTube URL
 *   that passes oEmbed validation (exists, embeddable, title matches the exercise).
 * Each resolved source (`imageSource`/`videoSource`) is returned to the caller for
 * traceability; persisting it durably is the caller's responsibility (the current
 * script logs it, the DB schema stores only the URLs).
 */

export type ExerciseMediaInput = {
  name: string;
  /** Optional English search term to improve catalog matching (defaults to `name`). */
  englishName?: string | null;
  muscleGroup?: string | null;
  currentImageUrl: string | null;
  currentVideoUrl: string | null;
};

export type ImageSource = 'existing' | 'free-exercise-db';
export type VideoSource = 'existing' | 'youtube-validated';

export type EnrichedExerciseMedia = {
  imageUrl: string | null;
  imageSource: ImageSource | null;
  videoUrl: string | null;
  videoSource: VideoSource | null;
  changed: boolean;
};

export type MediaEnrichmentDeps = {
  findImage: (searchName: string) => Promise<CatalogImageMatch | null>;
  suggestVideo: (input: { name: string; muscleGroup?: string | null }) => Promise<string | null>;
  validateVideo: (url: string, keywords: string[]) => Promise<ValidatedYoutubeVideo | null>;
};

function videoKeywords(input: ExerciseMediaInput): string[] {
  // Key off the movement name only: the muscle group ("Piernas", "Pecho") is too
  // broad and would let an unrelated "rutina de piernas" clip pass title validation.
  return [input.name, input.englishName ?? '']
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

/**
 * Resolves the best available media for a single exercise. Never overwrites media
 * that is already valid; only fills gaps and validates any new video.
 */
export async function enrichExerciseMedia(
  input: ExerciseMediaInput,
  deps: MediaEnrichmentDeps,
): Promise<EnrichedExerciseMedia> {
  let imageUrl = resolvedMediaUrl(input.currentImageUrl);
  let imageSource: ImageSource | null = imageUrl ? 'existing' : null;
  if (!imageUrl) {
    const match = await deps.findImage(input.englishName?.trim() || input.name);
    if (match && resolvedMediaUrl(match.imageUrl)) {
      imageUrl = match.imageUrl;
      imageSource = 'free-exercise-db';
    }
  }

  let videoUrl = resolvedExerciseVideo(input.currentVideoUrl) ? input.currentVideoUrl : null;
  let videoSource: VideoSource | null = videoUrl ? 'existing' : null;
  if (!videoUrl) {
    const suggested = await deps.suggestVideo({
      name: input.name,
      muscleGroup: input.muscleGroup,
    });
    if (suggested) {
      const validated = await deps.validateVideo(suggested, videoKeywords(input));
      if (validated) {
        videoUrl = validated.watchUrl;
        videoSource = 'youtube-validated';
      }
    }
  }

  const changed =
    imageUrl !== input.currentImageUrl || videoUrl !== input.currentVideoUrl;

  return { imageUrl, imageSource, videoUrl, videoSource, changed };
}
