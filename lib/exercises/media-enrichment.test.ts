import { describe, expect, it, jest } from '@jest/globals';
import { enrichExerciseMedia, type MediaEnrichmentDeps } from './media-enrichment';

function makeDeps(overrides: Partial<MediaEnrichmentDeps> = {}): MediaEnrichmentDeps {
  return {
    findImage: overrides.findImage ?? jest.fn(async () => null),
    suggestVideo: overrides.suggestVideo ?? jest.fn(async () => null),
    validateVideo: overrides.validateVideo ?? jest.fn(async () => null),
  };
}

describe('enrichExerciseMedia', () => {
  it('keeps valid existing media and does not fetch replacements', async () => {
    const deps = makeDeps();
    const result = await enrichExerciseMedia(
      {
        name: 'Sentadilla',
        currentImageUrl: 'https://cdn.example/squat.jpg',
        currentVideoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
      deps,
    );
    expect(result).toEqual({
      imageUrl: 'https://cdn.example/squat.jpg',
      imageSource: 'existing',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      videoSource: 'existing',
      changed: false,
    });
    expect(deps.findImage).not.toHaveBeenCalled();
    expect(deps.suggestVideo).not.toHaveBeenCalled();
  });

  it('fills a missing image from the catalog using the english name', async () => {
    const deps = makeDeps({
      findImage: jest.fn(async () => ({
        imageUrl: 'https://cdn.example/bench.jpg',
        matchedName: 'Barbell Bench Press',
        source: 'free-exercise-db' as const,
      })),
    });
    const result = await enrichExerciseMedia(
      {
        name: 'Press Banca',
        englishName: 'bench press',
        currentImageUrl: null,
        currentVideoUrl: null,
      },
      deps,
    );
    expect(deps.findImage).toHaveBeenCalledWith('bench press');
    expect(result.imageUrl).toBe('https://cdn.example/bench.jpg');
    expect(result.imageSource).toBe('free-exercise-db');
    expect(result.changed).toBe(true);
  });

  it('only persists a suggested video after oEmbed validation passes', async () => {
    const validated = {
      watchUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Sentadilla técnica',
      author: 'Canal',
    };
    const deps = makeDeps({
      suggestVideo: jest.fn(async () => 'https://youtu.be/dQw4w9WgXcQ'),
      validateVideo: jest.fn(async () => validated),
    });
    const result = await enrichExerciseMedia(
      { name: 'Sentadilla', currentImageUrl: null, currentVideoUrl: null },
      deps,
    );
    expect(deps.validateVideo).toHaveBeenCalledWith('https://youtu.be/dQw4w9WgXcQ', ['Sentadilla']);
    expect(result.videoUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(result.videoSource).toBe('youtube-validated');
  });

  it('excludes the muscle group from the video validation keywords', async () => {
    const deps = makeDeps({
      suggestVideo: jest.fn(async () => 'https://youtu.be/dQw4w9WgXcQ'),
      validateVideo: jest.fn(async () => null),
    });
    await enrichExerciseMedia(
      {
        name: 'Sentadilla',
        englishName: 'squat',
        muscleGroup: 'Piernas',
        currentImageUrl: null,
        currentVideoUrl: null,
      },
      deps,
    );
    expect(deps.validateVideo).toHaveBeenCalledWith('https://youtu.be/dQw4w9WgXcQ', [
      'Sentadilla',
      'squat',
    ]);
  });

  it('drops a suggested video that fails validation', async () => {
    const deps = makeDeps({
      suggestVideo: jest.fn(async () => 'https://youtu.be/wrong'),
      validateVideo: jest.fn(async () => null),
    });
    const result = await enrichExerciseMedia(
      { name: 'Sentadilla', currentImageUrl: null, currentVideoUrl: null },
      deps,
    );
    expect(result.videoUrl).toBeNull();
    expect(result.videoSource).toBeNull();
  });

  it('replaces an unsafe/search video url with a validated one', async () => {
    const deps = makeDeps({
      suggestVideo: jest.fn(async () => 'https://youtu.be/dQw4w9WgXcQ'),
      validateVideo: jest.fn(async () => ({
        watchUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'Sentadilla',
        author: null,
      })),
    });
    const result = await enrichExerciseMedia(
      {
        name: 'Sentadilla',
        currentImageUrl: null,
        currentVideoUrl: 'https://www.youtube.com/results?search_query=sentadilla',
      },
      deps,
    );
    expect(result.videoUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(result.videoSource).toBe('youtube-validated');
  });
});
