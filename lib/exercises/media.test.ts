import { describe, expect, it } from '@jest/globals';
import { MEDIA_URL_MAX_LENGTH } from '@/lib/validation/media-url';
import { isHttpsMediaUrl, isValidClientMediaUrl, resolvedMediaUrl } from './media';

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
