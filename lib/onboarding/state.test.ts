import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { isOnboardingDone, markOnboardingDone } from './state';

const STORAGE_KEY = 'atlas:onboarding:welcome-done';

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
  });});
