/**
 * @jest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { isInstallDismissed, markInstallDismissed } from './install-dismissal';

describe('install dismissal persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports false before the user dismisses the install prompt', () => {
    expect(isInstallDismissed()).toBe(false);
  });

  it('persists dismissal in localStorage', () => {
    markInstallDismissed();

    expect(isInstallDismissed()).toBe(true);
  });

  it('keeps the prompt eligible when localStorage reads throw', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('private mode read blocked');
    });

    expect(isInstallDismissed()).toBe(false);
  });

  it('does not throw when localStorage writes fail', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('private mode write blocked');
    });

    expect(() => markInstallDismissed()).not.toThrow();
  });
});
