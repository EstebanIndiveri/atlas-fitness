import { describe, expect, it } from '@jest/globals';
import { isHttpsMediaUrl, resolvedMediaUrl } from './media';

describe('resolvedMediaUrl', () => {
  it('treats empty or blank URLs as missing', () => {
    expect(resolvedMediaUrl(null)).toBeNull();
    expect(resolvedMediaUrl('   ')).toBeNull();
    expect(resolvedMediaUrl('https://cdn.example/a.png')).toBe('https://cdn.example/a.png');
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
