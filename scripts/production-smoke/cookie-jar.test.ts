/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';

import { CookieJar } from './cookie-jar';

describe('CookieJar', () => {
  it('captures and serializes cookies', () => {
    const jar = new CookieJar();
    jar.capture(['session=abc.def; Path=/; HttpOnly', 'other=1; Path=/']);
    expect(jar.header()).toBe('session=abc.def; other=1');
    expect(jar.isEmpty).toBe(false);
  });

  it('treats a Max-Age=0 clearing cookie as a removal', () => {
    const jar = new CookieJar();
    jar.capture(['session=abc; Path=/']);
    jar.capture(['session=; Max-Age=0; Path=/; HttpOnly']);
    expect(jar.header()).toBeNull();
    expect(jar.isEmpty).toBe(true);
  });

  it('clears all cookies explicitly', () => {
    const jar = new CookieJar();
    jar.capture(['a=1; Path=/', 'b=2; Path=/']);
    jar.clear();
    expect(jar.header()).toBeNull();
  });
});
