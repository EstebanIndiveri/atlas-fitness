import { describe, expect, it } from '@jest/globals';
import { bottomNavTestId, isCurrentPath } from './nav-links';

describe('isCurrentPath', () => {
  it('treats dashboard home as exact match only', () => {
    expect(isCurrentPath('/dashboard', '/dashboard')).toBe(true);
    expect(isCurrentPath('/dashboard/session', '/dashboard')).toBe(false);
  });

  it('treats nested session routes as the session tab', () => {
    expect(isCurrentPath('/dashboard/session', '/dashboard/session')).toBe(true);
    expect(isCurrentPath('/dashboard/session/12', '/dashboard/session')).toBe(true);
    expect(isCurrentPath('/dashboard/history', '/dashboard/session')).toBe(false);
  });
});

describe('bottomNavTestId', () => {
  it('prefixes tab ids for the mobile bar', () => {
    expect(bottomNavTestId('settings')).toBe('bottom-nav-settings');
  });
});
