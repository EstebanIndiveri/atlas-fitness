import { afterEach, describe, expect, it } from '@jest/globals';
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cwd } from 'node:process';

/**
 * Migration introduced by v0.10 Workstream B. Pinning the tag lets the fixture
 * reconstruct the exact pre-migration database the product would upgrade from.
 */
const NEW_MIGRATION_TAG = '0023_habit_target_schedules';
const MIGRATIONS_FOLDER = join(cwd(), 'lib/db/migrations');

interface JournalEntry {
  idx: number;
  tag: string;
  when: number;
}

interface Journal {
  entries: JournalEntry[];
}

/**
 * Copies the real migrations folder and strips the v0.10 migration, yielding the
 * schema an existing v0.9 database would already have.
 */
function copyPreMigrationFolder(destination: string): void {
  cpSync(MIGRATIONS_FOLDER, destination, { recursive: true });

  const journalPath = join(destination, 'meta/_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;
  const withoutNewMigration = journal.entries.filter((entry) => entry.tag !== NEW_MIGRATION_TAG);

  if (withoutNewMigration.length === journal.entries.length) {
    throw new Error(`Fixture setup failed: ${NEW_MIGRATION_TAG} not found in the journal`);
  }

  writeFileSync(
    journalPath,
    JSON.stringify({ ...journal, entries: withoutNewMigration }, null, 2),
  );
  rmSync(join(destination, `${NEW_MIGRATION_TAG}.sql`), { force: true });
}

function makeFixture(): {
  directory: string;
  databaseUrl: string;
  preMigrationFolder: string;
} {
  const directory = mkdtempSync(join(tmpdir(), 'atlas-habit-target-migration-'));
  return {
    directory,
    databaseUrl: `file:${join(directory, 'test.db')}`,
    preMigrationFolder: join(directory, 'pre-migrations'),
  };
}

describe('habit target schedules migration', () => {
  const cleanupDirectories: string[] = [];

  afterEach(() => {
    for (const directory of cleanupDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  async function migrateOldThenNew(): Promise<Client> {
    const { directory, databaseUrl, preMigrationFolder } = makeFixture();
    cleanupDirectories.push(directory);
    copyPreMigrationFolder(preMigrationFolder);

    const client = createClient({ url: databaseUrl });
    const db = drizzle(client);

    await migrate(db, { migrationsFolder: preMigrationFolder });
    await client.execute(
      "INSERT INTO users (name, email, password_hash) VALUES ('Legacy', 'legacy@example.com', 'hash')",
    );
    await client.execute(
      "INSERT INTO habit_logs (user_id, local_date, habit_key, done, amount) VALUES (1, '2026-09-01', 'walk', 1, NULL)",
    );

    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    return client;
  }

  it('upgrades a pre-v0.10 database with empty target tables and leaves habit_logs untouched', async () => {
    const client = await migrateOldThenNew();

    try {
      const tables = await client.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'habit_target_%' ORDER BY name",
      );
      expect(tables.rows.map((row) => row.name)).toEqual([
        'habit_target_days',
        'habit_target_schedules',
      ]);

      const schedules = await client.execute('SELECT COUNT(*) AS count FROM habit_target_schedules');
      const days = await client.execute('SELECT COUNT(*) AS count FROM habit_target_days');
      expect(Number(schedules.rows[0]?.count)).toBe(0);
      expect(Number(days.rows[0]?.count)).toBe(0);

      const logs = await client.execute(
        'SELECT user_id, local_date, habit_key, done, amount, created_at, updated_at FROM habit_logs',
      );
      expect(logs.rows).toHaveLength(1);
      expect(logs.rows[0]).toMatchObject({
        user_id: 1,
        local_date: '2026-09-01',
        habit_key: 'walk',
        done: 1,
        amount: null,
      });
      expect(logs.rows[0]?.created_at).not.toBeNull();
    } finally {
      client.close();
    }
  });

  it('declares the no-backfill rollback scope: only the two new tables exist for targets', async () => {
    const client = await migrateOldThenNew();

    try {
      const columns = await client.execute("PRAGMA table_info('habit_target_schedules')");
      expect(columns.rows.map((row) => row.name)).toEqual([
        'id',
        'user_id',
        'habit_key',
        'effective_from',
        'effective_to',
        'version',
        'created_at',
        'updated_at',
      ]);

      const dayColumns = await client.execute("PRAGMA table_info('habit_target_days')");
      expect(dayColumns.rows.map((row) => row.name)).toEqual(['schedule_id', 'day_of_week']);
      expect(dayColumns.rows.filter((row) => Number(row.pk) > 0).map((row) => row.name).sort()).toEqual(
        ['day_of_week', 'schedule_id'],
      );
    } finally {
      client.close();
    }
  });

  async function insertSchedule(
    client: Client,
    overrides: Partial<{
      habitKey: string;
      effectiveFrom: string;
      effectiveTo: string | null;
      version: number;
    }> = {},
  ): Promise<void> {
    await client.execute({
      sql: `INSERT INTO habit_target_schedules
              (user_id, habit_key, effective_from, effective_to, version, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 0, 0)`,
      args: [
        1,
        overrides.habitKey ?? 'walk',
        overrides.effectiveFrom ?? '2026-09-01',
        overrides.effectiveTo === undefined ? null : overrides.effectiveTo,
        overrides.version ?? 1,
      ],
    });
  }

  it('allows at most one active schedule per user and habit', async () => {
    const client = await migrateOldThenNew();

    try {
      await insertSchedule(client);
      await expect(
        insertSchedule(client, { effectiveFrom: '2026-09-02' }),
      ).rejects.toThrow(/unique/i);
    } finally {
      client.close();
    }
  });

  it('rejects a closed interval that ends before it starts', async () => {
    const client = await migrateOldThenNew();

    try {
      await expect(
        insertSchedule(client, { effectiveFrom: '2026-09-10', effectiveTo: '2026-09-01' }),
      ).rejects.toThrow(/check/i);
    } finally {
      client.close();
    }
  });

  it('rejects an out-of-catalog habit key and a non-positive version', async () => {
    const client = await migrateOldThenNew();

    try {
      await expect(insertSchedule(client, { habitKey: 'meditation' })).rejects.toThrow(/check/i);
      await expect(insertSchedule(client, { version: 0 })).rejects.toThrow(/check/i);
    } finally {
      client.close();
    }
  });

  it('rejects duplicate and out-of-range weekdays through the composite primary key and check', async () => {
    const client = await migrateOldThenNew();

    try {
      const [schedule] = (
        await client.execute(
          "INSERT INTO habit_target_schedules (user_id, habit_key, effective_from, effective_to, version, created_at, updated_at) VALUES (1, 'walk', '2026-09-01', NULL, 1, 0, 0) RETURNING id",
        )
      ).rows;
      const scheduleId = Number(schedule?.id);
      expect(scheduleId).toBeGreaterThan(0);

      await client.execute({
        sql: 'INSERT INTO habit_target_days (schedule_id, day_of_week) VALUES (?, ?)',
        args: [scheduleId, 1],
      });
      await expect(
        client.execute({
          sql: 'INSERT INTO habit_target_days (schedule_id, day_of_week) VALUES (?, ?)',
          args: [scheduleId, 1],
        }),
      ).rejects.toThrow(/unique|primary/i);
      await expect(
        client.execute({
          sql: 'INSERT INTO habit_target_days (schedule_id, day_of_week) VALUES (?, ?)',
          args: [scheduleId, 7],
        }),
      ).rejects.toThrow(/check/i);
    } finally {
      client.close();
    }
  });
});
