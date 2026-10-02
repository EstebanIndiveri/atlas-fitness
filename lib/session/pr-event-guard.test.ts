/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it } from '@jest/globals';

import {
  hasPrEventBeenSeen,
  markPrEventSeen,
  resetPrEventGuardForTests,
} from './pr-event-guard';

const KEY = '1:same_reps_external_load:3:8:total:bilateral:11';

afterEach(() => {
  resetPrEventGuardForTests();
  window.sessionStorage.clear();
});

describe('pr-event-guard', () => {
  it('reports an unseen event as not seen', () => {
    expect(hasPrEventBeenSeen(KEY)).toBe(false);
  });

  it('marks an event seen in memory and sessionStorage', () => {
    markPrEventSeen(KEY);
    expect(hasPrEventBeenSeen(KEY)).toBe(true);
    expect(window.sessionStorage.getItem(`atlas:verified-pr:${KEY}`)).toBe('1');
  });

  it('still dedupes from sessionStorage after the in-memory guard resets', () => {
    markPrEventSeen(KEY);
    resetPrEventGuardForTests();
    expect(hasPrEventBeenSeen(KEY)).toBe(true);
  });

  it('degrades safely when sessionStorage is unavailable', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() {
        throw new Error('storage disabled');
      },
    });

    try {
      expect(() => markPrEventSeen(KEY)).not.toThrow();
      expect(hasPrEventBeenSeen(KEY)).toBe(true); // in-memory guard still works
      resetPrEventGuardForTests();
      expect(hasPrEventBeenSeen(KEY)).toBe(false);
    } finally {
      if (original) {
        Object.defineProperty(window, 'sessionStorage', original);
      }
    }
  });
});
