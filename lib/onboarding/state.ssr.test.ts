/**
 * @jest-environment node
 */

import { describe, expect, it } from '@jest/globals';

import {
  clearOnboardingAnswers,
  isBrowserEnvironment,
  readOnboardingAnswers,
  saveOnboardingAnswers,
} from './state';

describe('onboarding storage state without a browser', () => {
  it('detects the absence of a browser window so storage access is skipped', () => {
    expect(isBrowserEnvironment()).toBe(false);
  });

  it('is safe when rendered without a browser window', () => {
    expect(readOnboardingAnswers()).toBeNull();
    expect(() => saveOnboardingAnswers({ goal: null, pace: null, equipment: null })).not.toThrow();
    expect(() => clearOnboardingAnswers()).not.toThrow();
  });
});
