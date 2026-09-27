import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  clearOnboardingAnswers,
  readOnboardingAnswers,
  saveOnboardingAnswers,
} from './state';

const ANSWERS_KEY = 'atlas:onboarding:answers';

describe('onboarding storage state', () => {
  afterEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  it('is safe when clearing answers while accessing localStorage itself throws', () => {
    const storageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Blocked', 'SecurityError');
      },
    });

    try {
      expect(readOnboardingAnswers()).toBeNull();
      expect(() => clearOnboardingAnswers()).not.toThrow();
    } finally {
      if (storageDescriptor) {
        Object.defineProperty(window, 'localStorage', storageDescriptor);
      }
    }
  });

  it('is safe when localStorage methods throw', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(readOnboardingAnswers()).toBeNull();
    expect(() => clearOnboardingAnswers()).not.toThrow();
    expect(() =>
      saveOnboardingAnswers({ goal: 'muscle', pace: null, equipment: null }),
    ).not.toThrow();
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

  it('clears saved answers after a successful explicit import', () => {
    saveOnboardingAnswers({ goal: 'muscle', pace: 'days-3', equipment: 'gym' });

    clearOnboardingAnswers();

    expect(readOnboardingAnswers()).toBeNull();
  });
});
