import { describe, expect, it, jest } from '@jest/globals';
import {
  FREE_EXERCISE_DB_IMAGE_BASE,
  findCatalogImage,
  normalizeExerciseName,
} from './free-exercise-db';

const DATASET = [
  { name: 'Barbell Bench Press - Medium Grip', images: ['Barbell_Bench_Press_-_Medium_Grip/0.jpg'] },
  { name: 'Barbell Full Squat', images: ['Barbell_Full_Squat/0.jpg'] },
  { name: 'Incline Dumbbell Press', images: [] },
];

describe('normalizeExerciseName', () => {
  it('strips accents, casing and punctuation into space-separated tokens', () => {
    expect(normalizeExerciseName('Press de Banca (inclinado)')).toBe('press de banca inclinado');
    expect(normalizeExerciseName('Sentadilla')).toBe('sentadilla');
  });
});

describe('findCatalogImage', () => {
  it('returns the best token-overlap match as an absolute image URL', async () => {
    const fetchJson = jest.fn(async () => DATASET);
    const match = await findCatalogImage('barbell bench press', { fetchJson });
    expect(match).toEqual({
      imageUrl: `${FREE_EXERCISE_DB_IMAGE_BASE}/Barbell_Bench_Press_-_Medium_Grip/0.jpg`,
      matchedName: 'Barbell Bench Press - Medium Grip',
      source: 'free-exercise-db',
    });
  });

  it('skips entries without images', async () => {
    const fetchJson = jest.fn(async () => DATASET);
    const match = await findCatalogImage('incline dumbbell press', { fetchJson });
    expect(match?.matchedName).not.toBe('Incline Dumbbell Press');
  });

  it('returns null when no entry shares a token', async () => {
    const fetchJson = jest.fn(async () => DATASET);
    expect(await findCatalogImage('yoga breathing', { fetchJson })).toBeNull();
  });

  it('rejects a multi-token query that shares only one generic token', async () => {
    const fetchJson = jest.fn(async () => DATASET);
    // "french press" (triceps) shares only "press" with "Barbell Bench Press"
    // and only "press" with "Barbell Full Squat" (none). A single generic token
    // must not be enough to persist a wrong-exercise image.
    expect(await findCatalogImage('french press', { fetchJson })).toBeNull();
  });

  it('returns null for a blank query without fetching', async () => {
    const fetchJson = jest.fn(async () => DATASET);
    expect(await findCatalogImage('   ', { fetchJson })).toBeNull();
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('returns null when the dataset is unreachable or malformed', async () => {
    const rejecting = jest.fn(async () => {
      throw new Error('network');
    });
    expect(await findCatalogImage('bench press', { fetchJson: rejecting })).toBeNull();

    const notArray = jest.fn(async () => ({ detail: 'Not found.' }));
    expect(await findCatalogImage('bench press', { fetchJson: notArray })).toBeNull();
  });
});
