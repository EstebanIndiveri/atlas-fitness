import { describe, expect, it } from '@jest/globals';
import { MEDIA_URL_MAX_LENGTH } from '@/lib/validation/media-url';
import {
  isHttpsMediaUrl,
  isValidClientMediaUrl,
  resolvedExerciseVideo,
  resolvedMediaUrl,
  youtubeVideoId,
} from './media';

describe('resolvedMediaUrl', () => {
  it('treats empty or blank URLs as missing', () => {
    expect(resolvedMediaUrl(null)).toBeNull();
    expect(resolvedMediaUrl('   ')).toBeNull();
    expect(resolvedMediaUrl('https://cdn.example/a.png')).toBe('https://cdn.example/a.png');
  });

  it('rejects http, javascript and data schemes for preview', () => {
    expect(resolvedMediaUrl('http://cdn.example/a.png')).toBeNull();
    expect(resolvedMediaUrl('javascript:alert(1)')).toBeNull();
    expect(resolvedMediaUrl('data:text/html,hi')).toBeNull();
  });

  it('rejects https URLs longer than 2048 characters', () => {
    const tooLong = `https://cdn.example/${'a'.repeat(MEDIA_URL_MAX_LENGTH)}`;
    expect(tooLong.length).toBeGreaterThan(MEDIA_URL_MAX_LENGTH);
    expect(resolvedMediaUrl(tooLong)).toBeNull();
  });
});

describe('isHttpsMediaUrl', () => {
  it('accepts https URLs and rejects http or non-URLs', () => {
    expect(isHttpsMediaUrl('https://cdn.example/a.png')).toBe(true);
    expect(isHttpsMediaUrl('http://cdn.example/a.png')).toBe(false);
    expect(isHttpsMediaUrl('ftp://cdn.example/a.png')).toBe(false);
    expect(isHttpsMediaUrl('not-a-url')).toBe(false);
    expect(isHttpsMediaUrl('https://')).toBe(false);
  });
});

describe('isValidClientMediaUrl', () => {
  it('accepts https URLs within 2048 characters', () => {
    expect(isValidClientMediaUrl('https://cdn.example/a.png')).toBe(true);
  });

  it('rejects untrusted schemes and over-length URLs', () => {
    expect(isValidClientMediaUrl('http://cdn.example/a.png')).toBe(false);
    expect(isValidClientMediaUrl('javascript:alert(1)')).toBe(false);
    expect(isValidClientMediaUrl('data:image/png;base64,abc')).toBe(false);
    const tooLong = `https://cdn.example/${'a'.repeat(MEDIA_URL_MAX_LENGTH)}`;
    expect(isValidClientMediaUrl(tooLong)).toBe(false);
  });
});

describe('youtubeVideoId', () => {
  it('extracts the id from watch, youtu.be, embed and shorts URLs', () => {
    expect(youtubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeVideoId('https://youtu.be/dQw4w9WgXcQ?t=30')).toBe('dQw4w9WgXcQ');
    expect(youtubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeVideoId('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('returns null for search results, other providers and malformed ids', () => {
    expect(youtubeVideoId('https://www.youtube.com/results?search_query=press+banca')).toBeNull();
    expect(youtubeVideoId('https://vimeo.com/12345')).toBeNull();
    expect(youtubeVideoId('https://www.youtube.com/watch?v=short')).toBeNull();
    expect(youtubeVideoId('not-a-url')).toBeNull();
  });
});

describe('resolvedExerciseVideo', () => {
  it('resolves youtube URLs to a privacy-friendly embed descriptor', () => {
    expect(resolvedExerciseVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      kind: 'youtube',
      embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      watchUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
  });

  it('resolves direct video files to a file descriptor regardless of case', () => {
    expect(resolvedExerciseVideo('https://wger.de/media/exercise-video/512/x.mp4')).toEqual({
      kind: 'file',
      src: 'https://wger.de/media/exercise-video/512/x.mp4',
    });
    expect(resolvedExerciseVideo('https://wger.de/media/exercise-video/512/x.MOV')).toEqual({
      kind: 'file',
      src: 'https://wger.de/media/exercise-video/512/x.MOV',
    });
  });

  it('returns null for youtube search links, unsafe schemes and unsupported URLs', () => {
    expect(
      resolvedExerciseVideo('https://www.youtube.com/results?search_query=press+banca'),
    ).toBeNull();
    expect(resolvedExerciseVideo('http://cdn.example/a.mp4')).toBeNull();
    expect(resolvedExerciseVideo('https://cdn.example/page.html')).toBeNull();
    expect(resolvedExerciseVideo(null)).toBeNull();
  });
});
