import { describe, expect, it, jest } from '@jest/globals';
import { playSessionCue } from './feedback';

describe('playSessionCue', () => {
  it('calls navigator.vibrate when available', () => {
    const vibrate = jest.fn((_pattern: number) => true);
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: vibrate,
    });

    playSessionCue();
    expect(vibrate).toHaveBeenCalledWith(200);
  });

  it('does not throw when vibrate is missing', () => {
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: undefined,
    });
    expect(() => playSessionCue()).not.toThrow();
  });
});
