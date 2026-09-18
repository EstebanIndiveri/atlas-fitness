import { afterEach, describe, expect, it } from '@jest/globals';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

import { inspectConfiguredDatabase, findMissingTables, REQUIRED_TABLES } from './readiness';

function makeTempDatabaseUrl(): { directory: string; url: string } {
  const directory = mkdtempSync(join(cwd(), '.readiness-db-'));
  return { directory, url: `file:${join(directory, 'test.db')}` };
}

describe('findMissingTables', () => {
  it('returns no missing tables for a complete schema', () => {
    expect(findMissingTables(REQUIRED_TABLES)).toEqual([]);
  });

  it('returns every required table absent from the database', () => {
    expect(findMissingTables(['users', 'workouts'])).toEqual(
      REQUIRED_TABLES.filter((name) => name !== 'users' && name !== 'workouts'),
    );
  });
});

describe('inspectConfiguredDatabase', () => {
  const originalDatabaseUrl = process.env.TURSO_DATABASE_URL;
  const originalAuthToken = process.env.TURSO_AUTH_TOKEN;
  const tempDirectories: string[] = [];

  afterEach(() => {
    process.env.TURSO_DATABASE_URL = originalDatabaseUrl;
    process.env.TURSO_AUTH_TOKEN = originalAuthToken;

    for (const directory of tempDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('returns every required table for an empty configured database', async () => {
    const { directory, url } = makeTempDatabaseUrl();
    tempDirectories.push(directory);
    process.env.TURSO_DATABASE_URL = url;
    delete process.env.TURSO_AUTH_TOKEN;

    await expect(inspectConfiguredDatabase()).resolves.toEqual({
      ready: false,
      missingTables: REQUIRED_TABLES,
      missingColumns: [],
      missingIndexes: [],
    });
  });

  it('returns not ready when every table exists but required columns and indexes are missing', async () => {
    const { directory, url } = makeTempDatabaseUrl();
    tempDirectories.push(directory);
    process.env.TURSO_DATABASE_URL = url;
    delete process.env.TURSO_AUTH_TOKEN;

    const client = createClient({ url });
    try {
      await migrate(drizzle(client), { migrationsFolder: './lib/db/migrations' });
      await client.execute('ALTER TABLE workouts DROP COLUMN routine_id');
      await client.execute('DROP INDEX daily_checkins_user_id_local_date_unique');
      await client.execute(
        'CREATE UNIQUE INDEX daily_checkins_user_id_local_date_unique ON daily_checkins (id)',
      );
    } finally {
      client.close();
    }

    await expect(inspectConfiguredDatabase()).resolves.toEqual({
      ready: false,
      missingTables: [],
      missingColumns: ['workouts.routine_id'],
      missingIndexes: ['daily_checkins_user_id_local_date_unique'],
    });
  });

  it('rejects a partial index when the required unique index must cover every row', async () => {
    const { directory, url } = makeTempDatabaseUrl();
    tempDirectories.push(directory);
    process.env.TURSO_DATABASE_URL = url;
    delete process.env.TURSO_AUTH_TOKEN;

    const client = createClient({ url });
    try {
      await migrate(drizzle(client), { migrationsFolder: './lib/db/migrations' });
      await client.execute('DROP INDEX users_email_unique');
      await client.execute(
        'CREATE UNIQUE INDEX users_email_unique ON users (email) WHERE id > 0',
      );
    } finally {
      client.close();
    }

    await expect(inspectConfiguredDatabase()).resolves.toEqual({
      ready: false,
      missingTables: [],
      missingColumns: [],
      missingIndexes: ['users_email_unique'],
    });
  });

  it('rejects a required partial index when its predicate is inverted', async () => {
    const { directory, url } = makeTempDatabaseUrl();
    tempDirectories.push(directory);
    process.env.TURSO_DATABASE_URL = url;
    delete process.env.TURSO_AUTH_TOKEN;

    const client = createClient({ url });
    try {
      await migrate(drizzle(client), { migrationsFolder: './lib/db/migrations' });
      await client.execute('DROP INDEX workout_sets_workout_id_set_index_unique');
      await client.execute(`
        CREATE UNIQUE INDEX workout_sets_workout_id_set_index_unique
        ON workout_sets (workout_id, set_index)
        WHERE deleted_at IS NOT NULL
      `);
    } finally {
      client.close();
    }

    await expect(inspectConfiguredDatabase()).resolves.toEqual({
      ready: false,
      missingTables: [],
      missingColumns: [],
      missingIndexes: ['workout_sets_workout_id_set_index_unique'],
    });
  });

  it('accepts harmless predicate whitespace, quoting, and case differences', async () => {
    const { directory, url } = makeTempDatabaseUrl();
    tempDirectories.push(directory);
    process.env.TURSO_DATABASE_URL = url;
    delete process.env.TURSO_AUTH_TOKEN;

    const client = createClient({ url });
    try {
      await migrate(drizzle(client), { migrationsFolder: './lib/db/migrations' });
      await client.execute('DROP INDEX workout_sets_workout_id_set_index_unique');
      await client.execute(`
        CREATE UNIQUE INDEX workout_sets_workout_id_set_index_unique
        ON workout_sets (workout_id, set_index)
        where "DELETED_AT"    is
        null
      `);
    } finally {
      client.close();
    }

    await expect(inspectConfiguredDatabase()).resolves.toEqual({
      ready: true,
      missingTables: [],
      missingColumns: [],
      missingIndexes: [],
    });
  });

  it('returns ready after the configured database has been migrated', async () => {
    const { directory, url } = makeTempDatabaseUrl();
    tempDirectories.push(directory);
    process.env.TURSO_DATABASE_URL = url;
    delete process.env.TURSO_AUTH_TOKEN;

    const client = createClient({ url });
    try {
      await migrate(drizzle(client), { migrationsFolder: './lib/db/migrations' });
    } finally {
      client.close();
    }

    expect(existsSync(join(directory, 'test.db'))).toBe(true);
    await expect(inspectConfiguredDatabase()).resolves.toEqual({
      ready: true,
      missingTables: [],
      missingColumns: [],
      missingIndexes: [],
    });
  });
});
