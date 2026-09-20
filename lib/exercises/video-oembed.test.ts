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
