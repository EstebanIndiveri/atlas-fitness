import { eq } from 'drizzle-orm';
import { db } from '../lib/db/client';
import { exercises } from '../lib/db/schema';
import { suggestGeminiExerciseVideo } from '../lib/ai/gemini-exercise-video';
import { enrichExerciseMedia } from '../lib/exercises/media-enrichment';
import { findCatalogImage } from '../lib/exercises/catalog/free-exercise-db';
import { validateYoutubeVideo } from '../lib/exercises/video-oembed';

/**
 * Populates exercise images/videos automatically (no manual uploads).
 *
 * image  -> free-exercise-db catalog match
 * video  -> Gemini-suggested YouTube URL, validated via oEmbed (exists + title match)
 *
 * Existing valid media is preserved. Run with: `npm run db:enrich:media`.
 */

/** Spanish -> English search hints so the English-only image catalog matches well. */
const ENGLISH_SEARCH_ALIASES: Record<string, string> = {
  'press banca': 'barbell bench press',
  sentadilla: 'barbell full squat',
  'peso muerto': 'barbell deadlift',
  'press militar': 'standing military press',
  'remo con barra': 'bent over barbell row',
};

function englishSearchFor(name: string): string {
  return ENGLISH_SEARCH_ALIASES[name.trim().toLowerCase()] ?? name;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function fetchOembed(oembedUrl: string): Promise<{ status: number; json: unknown }> {
  const response = await fetch(oembedUrl);
  const json = response.ok ? await response.json() : null;
  return { status: response.status, json };
}

async function main(): Promise<void> {
  const rows = await db.select().from(exercises);
  let updated = 0;

  for (const exercise of rows) {
    if (exercise.deletedAt) {
      continue;
    }
    const result = await enrichExerciseMedia(
      {
        name: exercise.name,
        englishName: englishSearchFor(exercise.name),
        muscleGroup: exercise.muscleGroup,
        currentImageUrl: exercise.imageUrl,
        currentVideoUrl: exercise.videoUrl,
      },
      {
        findImage: (searchName) => findCatalogImage(searchName, { fetchJson }),
        suggestVideo: (input) => suggestGeminiExerciseVideo(input),
        validateVideo: (url, keywords) =>
          validateYoutubeVideo(url, { fetchOembed }, keywords),
      },
    );

    if (!result.changed) {
      continue;
    }
    await db
      .update(exercises)
      .set({ imageUrl: result.imageUrl, videoUrl: result.videoUrl })
      .where(eq(exercises.id, exercise.id));
    updated += 1;
    console.log(
      `Updated "${exercise.name}": image=${result.imageSource ?? 'none'} video=${result.videoSource ?? 'none'}`,
    );
  }

  console.log(`Media enrichment complete. ${updated}/${rows.length} exercise(s) updated.`);
}

main().catch((error) => {
  console.error('Media enrichment failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
