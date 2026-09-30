import { afterEach, describe, expect, it } from '@jest/globals';
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cwd } from 'node:process';

/**
 * Migration introduced by v0.11 Workstream B. Pinning the tag lets the fixture
 * reconstruct the exact pre-migration database the product would upgrade from.
 */
const NEW_MIGRATION_TAG = '0024_workout_exercise_notes';
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
 * Copies the real migrations folder and strips the v0.11 migration plus every later
 * migration, yielding the schema an existing v0.10 database would already have.
 * Stripping only the tagged entry is not enough: a later additive migration left in
 * the pre-folder would be applied first and make the migrator skip this one by timestamp.
 */
function copyPreMigrationFolder(destination: string): void {
  cpSync(MIGRATIONS_FOLDER, destination, { recursive: true });

  const journalPath = join(destination, 'meta/_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;
  const targetIndex = journal.entries.find((entry) => entry.tag === NEW_MIGRATION_TAG)?.idx;

  if (targetIndex === undefined) {
    throw new Error(`Fixture setup failed: ${NEW_MIGRATION_TAG} not found in the journal`);
  }

  const preMigrationEntries = journal.entries.filter((entry) => entry.idx < targetIndex);
  const strippedEntries = journal.entries.filter((entry) => entry.idx >= targetIndex);

  writeFileSync(
    journalPath,
    JSON.stringify({ ...journal, entries: preMigrationEntries }, null, 2),
  );

  for (const entry of strippedEntries) {
    rmSync(join(destination, `${entry.tag}.sql`), { force: true });
  }
}

function makeFixture(): {
  directory: string;
  databaseUrl: string;
  preMigrationFolder: string;
} {
  const directory = mkdtempSync(join(tmpdir(), 'atlas-exercise-note-migration-'));
  return {
    directory,
    databaseUrl: `file:${join(directory, 'test.db')}`,
    preMigrationFolder: join(directory, 'pre-migrations'),
  };
}

describe('workout exercise notes migration', () => {
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
      "INSERT INTO exercises (slug, name, muscle_group, instructions, is_system) VALUES ('legacy-bench', 'Banco', 'Pecho', 'x', 1)",
    );
    await client.execute(
      "INSERT INTO workouts (user_id, started_at, ended_at) VALUES (1, 1700000000, 1700003600)",
    );
    await client.execute(
      "INSERT INTO workout_sets (workout_id, exercise_id, set_index, reps, weight_kg, completed) VALUES (1, 1, 1, 8, '80.5', 1)",
    );

    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    return client;
  }

  it('upgrades a pre-v0.11 database with an empty notes table and leaves workouts/sets untouched', async () => {
    const client = await migrateOldThenNew();

    try {
      const tables = await client.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'workout_exercise_notes'",
      );
      expect(tables.rows.map((row) => row.name)).toEqual(['workout_exercise_notes']);

      const notes = await client.execute('SELECT COUNT(*) AS count FROM workout_exercise_notes');
      expect(Number(notes.rows[0]?.count)).toBe(0);

      const workouts = await client.execute(
        'SELECT id, user_id, started_at, ended_at, deleted_at FROM workouts',
      );
      expect(workouts.rows).toHaveLength(1);
      expect(workouts.rows[0]).toMatchObject({
        id: 1,
        user_id: 1,
        started_at: 1700000000,
        ended_at: 1700003600,
        deleted_at: null,
      });

      const sets = await client.execute(
        'SELECT id, workout_id, exercise_id, set_index, reps, weight_kg, completed, deleted_at FROM workout_sets',
      );
      expect(sets.rows).toHaveLength(1);
      expect(sets.rows[0]).toMatchObject({
        id: 1,
        workout_id: 1,
        exercise_id: 1,
        set_index: 1,
        reps: 8,
        weight_kg: '80.5',
        completed: 1,
        deleted_at: null,
      });
    } finally {
      client.close();
    }
  });

  it('declares the additive-only column shape of workout_exercise_notes', async () => {
    const client = await migrateOldThenNew();

    try {
      const columns = await client.execute("PRAGMA table_info('workout_exercise_notes')");
      expect(columns.rows.map((row) => row.name)).toEqual([
        'id',
        'user_id',
        'workout_id',
        'exercise_id',
        'note',
        'version',
        'created_at',
        'updated_at',
      ]);
      expect(columns.rows.map((row) => String(row.type).toLowerCase())).toEqual([
        'integer',
        'integer',
        'integer',
        'integer',
        'text',
        'integer',
        'integer',
        'integer',
      ]);
      const notNull = columns.rows.filter((row) => Number(row.notnull) === 1).map((row) => row.name);
      expect(notNull).toEqual([
        'id',
        'user_id',
        'workout_id',
        'exercise_id',
        'note',
        'version',
        'created_at',
        'updated_at',
      ]);
    } finally {
      client.close();
    }
  });

  it('adds exactly the three additive indexes without redundant duplicates', async () => {
    const client = await migrateOldThenNew();

    try {
      const indexes = await client.execute(
        "SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' AND name IN ('workout_exercise_notes_workout_exercise_unique', 'workout_exercise_notes_user_exercise_updated_idx', 'workouts_user_id_ended_at_idx', 'workout_sets_exercise_lookup_idx') ORDER BY name",
      );
      expect(indexes.rows.map((row) => `${row.tbl_name}:${row.name}`).sort()).toEqual([
        'workout_exercise_notes:workout_exercise_notes_user_exercise_updated_idx',
        'workout_exercise_notes:workout_exercise_notes_workout_exercise_unique',
        'workout_sets:workout_sets_exercise_lookup_idx',
        'workouts:workouts_user_id_ended_at_idx',
      ]);
    } finally {
      client.close();
    }
  });

  it('enforces one note per workout/exercise and the version check', async () => {
    const client = await migrateOldThenNew();

    try {
      await expect(
        client.execute(
          "INSERT INTO workout_exercise_notes (user_id, workout_id, exercise_id, note, version, created_at, updated_at) VALUES (1, 1, 1, 'nota', 0, 0, 0)",
        ),
      ).rejects.toThrow(/check/i);

      await client.execute(
        "INSERT INTO workout_exercise_notes (user_id, workout_id, exercise_id, note, version, created_at, updated_at) VALUES (1, 1, 1, 'nota', 1, 0, 0)",
      );

      await expect(
        client.execute(
          "INSERT INTO workout_exercise_notes (user_id, workout_id, exercise_id, note, version, created_at, updated_at) VALUES (1, 1, 1, 'otra', 1, 0, 0)",
        ),
      ).rejects.toThrow(/unique/i);
    } finally {
      client.close();
    }
  });
});
