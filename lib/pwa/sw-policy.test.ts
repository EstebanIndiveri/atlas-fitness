import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PRECACHE_URLS,
  isStaticBuildAsset,
  shouldBypassServiceWorker,
} from './sw-policy';

describe('shouldBypassServiceWorker', () => {
  it('bypasses authenticated API GETs so session cookies hit the network', () => {
    expect(shouldBypassServiceWorker('/api/auth/me', 'GET')).toBe(true);
    expect(shouldBypassServiceWorker('/api/workouts', 'GET')).toBe(true);
    expect(shouldBypassServiceWorker('/api/workouts/active', 'GET')).toBe(true);
  });

  it('bypasses mutating methods including workout writes', () => {
    expect(shouldBypassServiceWorker('/api/workouts', 'POST')).toBe(true);
    expect(shouldBypassServiceWorker('/dashboard', 'POST')).toBe(true);
  });

  it('does not bypass the public shell GET', () => {
    expect(shouldBypassServiceWorker('/', 'GET')).toBe(false);
    expect(shouldBypassServiceWorker('/manifest.webmanifest', 'GET')).toBe(false);
    expect(shouldBypassServiceWorker('/icon-192.png', 'GET')).toBe(false);
  });
});

describe('isStaticBuildAsset', () => {
  it('matches hashed Next static files only', () => {
    expect(isStaticBuildAsset('/_next/static/chunks/app.js')).toBe(true);
    expect(isStaticBuildAsset('/_next/data/build/index.json')).toBe(false);
    expect(isStaticBuildAsset('/api/tips/today')).toBe(false);
  });
});

describe('service worker source contract', () => {
  const source = readFileSync(join(process.cwd(), 'public/sw.js'), 'utf8');

  it('precache list in sw.js matches PRECACHE_URLS', () => {
    for (const url of PRECACHE_URLS) {
      expect(source).toContain(`'${url}'`);
    }
  });

  it('never intercepts /api/ and does not register Background Sync', () => {
    expect(source).toMatch(/\/api\//);
    expect(source).not.toMatch(/addEventListener\(\s*['"]sync['"]/);
    expect(source).not.toMatch(/periodicsync/i);
  });
});
