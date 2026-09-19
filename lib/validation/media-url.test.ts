/**
 * @jest-environment node
 */
import { describe, it, expect } from '@jest/globals';
import {
  MEDIA_URL_LENGTH_MESSAGE,
  MEDIA_URL_MAX_LENGTH,
  MEDIA_URL_SCHEME_MESSAGE,
  normalizeMediaUrl,
} from '@/lib/validation/media-url';

function expectValidation(value: string, message: string) {
  try {
    normalizeMediaUrl(value);
    throw new Error('expected AppError');
  } catch (error) {
    expect(error).toMatchObject({ code: 'VALIDATION', message });
  }
}

describe('normalizeMediaUrl', () => {
  it('treats null and empty as cleared media', () => {
    expect(normalizeMediaUrl(null)).toBeNull();
    expect(normalizeMediaUrl(undefined)).toBeNull();
    expect(normalizeMediaUrl('')).toBeNull();
    expect(normalizeMediaUrl('   ')).toBeNull();
  });

  it('accepts https URLs within the max length', () => {
    expect(normalizeMediaUrl('https://cdn.example.com/bench.png')).toBe(
      'https://cdn.example.com/bench.png',
    );
    const exact = `https://example.com/${'a'.repeat(MEDIA_URL_MAX_LENGTH - 'https://example.com/'.length)}`;
    expect(exact).toHaveLength(MEDIA_URL_MAX_LENGTH);
    expect(normalizeMediaUrl(exact)).toBe(exact);
  });

  it('rejects non-https schemes and relative URLs', () => {
    for (const value of [
      'http://cdn.example.com/bench.png',
      'data:image/png;base64,aaaa',
      'javascript:alert(1)',
      '/relative/path.png',
      '//cdn.example.com/bench.png',
      'cdn.example.com/bench.png',
    ]) {
      expectValidation(value, MEDIA_URL_SCHEME_MESSAGE);
    }
  });

  it('rejects URLs longer than 2048 characters', () => {
    const tooLong = `https://example.com/${'a'.repeat(MEDIA_URL_MAX_LENGTH)}`;
    expect(tooLong.length).toBeGreaterThan(MEDIA_URL_MAX_LENGTH);
    expectValidation(tooLong, MEDIA_URL_LENGTH_MESSAGE);
  });
});
