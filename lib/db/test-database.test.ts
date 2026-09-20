import { describe, expect, it } from '@jest/globals';
import {
  assertSafeTestDatabaseUrl,
  isUnsafeTestDatabaseUrl,
  resolveDatabaseUrl,
} from './test-database';

describe('test database URL guard', () => {
  it('refuses local.db and remote Turso URLs', () => {
    expect(isUnsafeTestDatabaseUrl('file:./local.db')).toBe(true);
    expect(isUnsafeTestDatabaseUrl('file:local.db')).toBe(true);
    expect(isUnsafeTestDatabaseUrl('file:/tmp/../local.db')).toBe(true);
    expect(isUnsafeTestDatabaseUrl('libsql://atlas.turso.io')).toBe(true);
    expect(isUnsafeTestDatabaseUrl('https://atlas.turso.io')).toBe(true);
    expect(isUnsafeTestDatabaseUrl('')).toBe(true);
  });

  it('allows isolated temp files and in-memory URLs', () => {
    expect(isUnsafeTestDatabaseUrl('file:/tmp/atlas-jest-1/test.db')).toBe(false);
    expect(isUnsafeTestDatabaseUrl('file::memory:')).toBe(false);
    expect(isUnsafeTestDatabaseUrl(':memory:')).toBe(false);
  });

  it('throws a clear error for dangerous test URLs', () => {
    expect(() => assertSafeTestDatabaseUrl('file:./local.db')).toThrow(/local\.db/);
    expect(() => assertSafeTestDatabaseUrl('libsql://atlas.turso.io')).toThrow(/Turso/);
  });

  it('resolveDatabaseUrl refuses dangerous URLs under Jest', () => {
    expect(() =>
      resolveDatabaseUrl({
        JEST_WORKER_ID: '1',
        TURSO_DATABASE_URL: 'file:./local.db',
      }),
    ).toThrow(/local\.db/);

    expect(() =>
      resolveDatabaseUrl({
        JEST_WORKER_ID: '1',
        TURSO_DATABASE_URL: 'libsql://atlas.turso.io',
      }),
    ).toThrow(/Turso/);
  });

  it('resolveDatabaseUrl requires an explicit URL under Jest', () => {
    expect(() => resolveDatabaseUrl({ JEST_WORKER_ID: '1' })).toThrow(/isolated/);
  });

  it('falls back to local.db only outside Jest', () => {
    expect(resolveDatabaseUrl({})).toBe('file:./local.db');
    expect(
      resolveDatabaseUrl({ TURSO_DATABASE_URL: 'file:/tmp/custom.db' }),
    ).toBe('file:/tmp/custom.db');
  });

  it('npm test is pinned to an isolated temp file, not local.db or Turso', () => {
    const url = process.env.TURSO_DATABASE_URL ?? '';
    expect(url).toMatch(/^file:/);
    expect(isUnsafeTestDatabaseUrl(url)).toBe(false);
    expect(url.toLowerCase()).not.toContain('local.db');
  });
});
