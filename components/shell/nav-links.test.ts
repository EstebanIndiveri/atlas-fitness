import { describe, expect, it } from '@jest/globals';
import { APP_NAV_LINKS, bottomNavTestId, isCurrentPath } from './nav-links';

describe('APP_NAV_LINKS', () => {
  it('exposes the four mockup tabs mapped to real routes', () => {
    expect(APP_NAV_LINKS.map((link) => [link.label, link.href, link.tabId])).toEqual([
      ['Hoy', '/dashboard/today', 'today'],
      ['Entrenar', '/dashboard/session', 'session'],
      ['Progreso', '/dashboard/progress', 'progress'],
      ['Perfil', '/dashboard/settings', 'profile'],
    ]);
  });
});

describe('isCurrentPath', () => {
  it('treats dashboard home as exact match only', () => {
    expect(isCurrentPath('/dashboard', '/dashboard')).toBe(true);
    expect(isCurrentPath('/dashboard/session', '/dashboard')).toBe(false);
  });

  it('treats nested session routes as the session tab', () => {
    expect(isCurrentPath('/dashboard/session', '/dashboard/session')).toBe(true);
    expect(isCurrentPath('/dashboard/session/12', '/dashboard/session')).toBe(true);
    expect(isCurrentPath('/dashboard/progress', '/dashboard/session')).toBe(false);
  });
});

describe('bottomNavTestId', () => {
  it('prefixes tab ids for the mobile bar', () => {
    expect(bottomNavTestId('profile')).toBe('bottom-nav-profile');
  });
});
