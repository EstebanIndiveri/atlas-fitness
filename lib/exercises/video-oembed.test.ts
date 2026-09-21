import { describe, expect, it, jest } from '@jest/globals';
import { titleMatchesExercise, validateYoutubeVideo } from './video-oembed';

const ok = (title: string, author = 'Canal Fit') => ({
  status: 200,
  json: { title, author_name: author },
});

describe('titleMatchesExercise', () => {
  it('matches ignoring accents and casing', () => {
    expect(titleMatchesExercise('Técnica de Sentadilla con barra', ['sentadilla'])).toBe(true);
    expect(titleMatchesExercise('How to Bench Press', ['press banca', 'bench'])).toBe(true);
  });

  it('matches a real title that shares the movement token but not the full phrase', () => {
    // Gemini returns a valid "The Bench Press" clip; the stored keywords are the
    // full Spanish/English names. A shared distinctive token must be enough.
    // (All three flip from false->true vs the old full-phrase-substring logic.)
    expect(titleMatchesExercise('The Bench Press', ['Press Banca', 'barbell bench press'])).toBe(
      true,
    );
    expect(titleMatchesExercise('How to Squat', ['Sentadilla', 'barbell full squat'])).toBe(true);
    expect(titleMatchesExercise('Deadlift form check', ['Peso Muerto', 'barbell deadlift'])).toBe(
      true,
    );
  });

  it('does not match on a shared generic gym word alone', () => {
    // "leg press" and "bench press" share only the generic token "press".
    expect(
      titleMatchesExercise('Leg Press en máquina', ['Press Banca', 'barbell bench press']),
    ).toBe(false);
    // "peso" (weight) is generic in es-AR: a bodyweight routine is not a deadlift.
    // This fails unless "peso" is treated as generic, locking that stopword in.
    expect(
      titleMatchesExercise('Rutina de peso corporal', ['Peso Muerto', 'barbell deadlift']),
    ).toBe(false);
  });

  it('does not match unrelated titles or blank keywords', () => {
    expect(titleMatchesExercise('Cooking pasta', ['sentadilla'])).toBe(false);
    expect(titleMatchesExercise('anything', ['  '])).toBe(false);
  });
});

describe('validateYoutubeVideo', () => {
  it('returns the canonical watch url and title for an embeddable video', async () => {
    const fetchOembed = jest.fn(async () => ok('Sentadilla técnica'));
    const result = await validateYoutubeVideo(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      { fetchOembed },
      ['sentadilla'],
    );
    expect(result).toEqual({
      watchUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Sentadilla técnica',
      author: 'Canal Fit',
    });
  });

  it('rejects a video whose title does not match the exercise keywords', async () => {
    const fetchOembed = jest.fn(async () => ok('Receta de pizza'));
    const result = await validateYoutubeVideo(
      'https://youtu.be/dQw4w9WgXcQ',
      { fetchOembed },
      ['sentadilla'],
    );
    expect(result).toBeNull();
  });

  it('rejects non-youtube, non-200 and failed lookups', async () => {
    const fetchOembed = jest.fn(async () => ok('x'));
    expect(await validateYoutubeVideo('https://vimeo.com/1', { fetchOembed })).toBeNull();
    expect(fetchOembed).not.toHaveBeenCalled();

    const notFound = jest.fn(async () => ({ status: 404, json: null }));
    expect(
      await validateYoutubeVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
        fetchOembed: notFound,
      }),
    ).toBeNull();

    const throws = jest.fn(async () => {
      throw new Error('network');
    });
    expect(
      await validateYoutubeVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
        fetchOembed: throws,
      }),
    ).toBeNull();
  });
});
