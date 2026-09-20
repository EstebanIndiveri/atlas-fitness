/**
 * free-exercise-db (yuhonas) catalog provider.
 *
 * Openly-licensed dataset of exercises with real demonstration images, served as
 * static JSON + JPGs from GitHub (no API key, no rate limit). Used to auto-populate
 * exercise images so users never have to upload a photo.
 *
 * @see https://github.com/yuhonas/free-exercise-db
 */

export const FREE_EXERCISE_DB_DATASET_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
export const FREE_EXERCISE_DB_IMAGE_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

/** Minimal shape of a free-exercise-db entry (only the fields we consume). */
export type FreeExerciseEntry = {
  name: string;
  images: string[];
};

export type CatalogImageMatch = {
  imageUrl: string;
  matchedName: string;
  source: 'free-exercise-db';
};

/** Injected JSON fetcher so the provider stays pure and unit-testable (no network). */
export type FetchJson = (url: string) => Promise<unknown>;

/** Accent-insensitive, alphanumeric token normalization for fuzzy name matching. */
export function normalizeExerciseName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeExerciseName(value).split(' ').filter(Boolean);
}

function isFreeExerciseEntry(value: unknown): value is FreeExerciseEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.name === 'string' &&
    Array.isArray(entry.images) &&
    entry.images.every((image) => typeof image === 'string')
  );
}

/**
 * Scores how well a dataset entry matches the query by shared tokens.
 * Returns the shared-token count plus a coverage-based score for tie-breaking.
 */
function scoreMatch(
  queryTokens: string[],
  candidate: string,
): { shared: number; score: number } {
  const candidateTokens = new Set(tokenize(candidate));
  const shared = queryTokens.filter((token) => candidateTokens.has(token)).length;
  if (shared === 0) {
    return { shared: 0, score: 0 };
  }
  // Reward coverage of the query and lightly penalize noisy long candidate names.
  return { shared, score: shared / queryTokens.length - candidateTokens.size * 0.001 };
}

/**
 * Minimum shared tokens required to accept a match. Multi-token queries need at
 * least two overlaps so a single generic token ("press", "barbell", "cable")
 * never persists a wrong-exercise image; single-token queries need the token.
 */
function minSharedTokens(queryTokenCount: number): number {
  return queryTokenCount >= 2 ? 2 : 1;
}

/**
 * Finds the best-matching exercise image for a search term (ideally an English name).
 * Returns null when the dataset is unreachable/invalid or no entry shares a token.
 *
 * @param searchName English exercise name or keywords (e.g. "bench press").
 * @param deps Injected `fetchJson` returning the parsed dataset array.
 */
export async function findCatalogImage(
  searchName: string,
  deps: { fetchJson: FetchJson },
): Promise<CatalogImageMatch | null> {
  const queryTokens = tokenize(searchName);
  if (queryTokens.length === 0) {
    return null;
  }

  let raw: unknown;
  try {
    raw = await deps.fetchJson(FREE_EXERCISE_DB_DATASET_URL);
  } catch {
    return null;
  }
  if (!Array.isArray(raw)) {
    return null;
  }

  const required = minSharedTokens(queryTokens.length);
  let best: { entry: FreeExerciseEntry; score: number } | null = null;
  for (const candidate of raw) {
    if (!isFreeExerciseEntry(candidate) || candidate.images.length === 0) {
      continue;
    }
    const { shared, score } = scoreMatch(queryTokens, candidate.name);
    if (shared >= required && (best === null || score > best.score)) {
      best = { entry: candidate, score };
    }
  }

  if (!best) {
    return null;
  }
  return {
    imageUrl: `${FREE_EXERCISE_DB_IMAGE_BASE}/${best.entry.images[0]}`,
    matchedName: best.entry.name,
    source: 'free-exercise-db',
  };
}
