import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  isOnboardingDone,
  markOnboardingDone,
  readOnboardingAnswers,
  saveOnboardingAnswers,
} from './state';

const STORAGE_KEY = 'atlas:onboarding:welcome-done';
const ANSWERS_KEY = 'atlas:onboarding:answers';

describe('onboarding storage state', () => {
  afterEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  it('returns false before completion and true after marking done', () => {
    expect(isOnboardingDone()).toBe(false);

    markOnboardingDone();

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('true');
    expect(isOnboardingDone()).toBe(true);
  });

  it('is safe when accessing localStorage itself throws', () => {
    const storageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Blocked', 'SecurityError');
      },
    });

    try {
      expect(isOnboardingDone()).toBe(false);
      expect(() => markOnboardingDone()).not.toThrow();
    } finally {
      if (storageDescriptor) {
        Object.defineProperty(window, 'localStorage', storageDescriptor);
      }
    }
  });

  it('is safe when localStorage throws', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(isOnboardingDone()).toBe(false);
    expect(() => markOnboardingDone()).not.toThrow();
  });

  it('round-trips onboarding answers through storage', () => {
    expect(readOnboardingAnswers()).toBeNull();

    saveOnboardingAnswers({ goal: 'muscle', pace: 'days-3', equipment: 'gym' });

    expect(JSON.parse(window.localStorage.getItem(ANSWERS_KEY) ?? 'null')).toEqual({
      goal: 'muscle',
      pace: 'days-3',
      equipment: 'gym',
    });
    expect(readOnboardingAnswers()).toEqual({ goal: 'muscle', pace: 'days-3', equipment: 'gym' });
  });

  it('returns null for malformed stored answers', () => {
    window.localStorage.setItem(ANSWERS_KEY, '{"goal":42}');
    expect(readOnboardingAnswers()).toBeNull();

    window.localStorage.setItem(ANSWERS_KEY, 'not json');
    expect(readOnboardingAnswers()).toBeNull();
  });

  it('does not throw when persisting answers and storage fails', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    expect(() =>
      saveOnboardingAnswers({ goal: 'muscle', pace: null, equipment: null }),
    ).not.toThrow();
  });
});
