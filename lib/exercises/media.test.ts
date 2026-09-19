import { describe, expect, it } from '@jest/globals';
import { resolvedMediaUrl } from './media';

describe('resolvedMediaUrl', () => {
  it('treats empty or blank URLs as missing', () => {
    expect(resolvedMediaUrl(null)).toBeNull();
    expect(resolvedMediaUrl('   ')).toBeNull();
    expect(resolvedMediaUrl('https://cdn.example/a.png')).toBe('https://cdn.example/a.png');
  });
});
