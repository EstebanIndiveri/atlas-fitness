import { afterEach, describe, expect, it } from '@jest/globals';
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cwd } from 'node:process';

/**
 * Migration introduced by v0.12 Workstream B. Pinning the tag lets the fixture
 * reconstruct the exact pre-migration database the product would upgrade from:
 * legacy sets retain all six semantic columns NULL and their raw `weight_kg`.
 */
const NEW_MIGRATION_TAG = '0025_workout_sets_semantics';
const MIGRATIONS_FOLDER = join(cwd(), 'lib/db/migrations');
const NEW_COLUMNS = [
  'semantic_capture_version',
  'load_mode',
  'amount_basis',
  'side',
  'set_purpose',
  'rep_count_basis',
] as const;

interface JournalEntry {
  idx: number;
  tag: string;
  when: number;
}

interface Journal {
  entries: JournalEntry[];
}

/**
 * Copies the real migrations folder and strips the v0.12 migration plus every later
 * migration, yielding the schema an existing v0.11 database would already have.
 * A later additive migration must not remain in the pre-folder: it would be applied
 * first and make the migrator skip this one by timestamp.
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
  const directory = mkdtempSync(join(tmpdir(), 'atlas-sets-semantics-migration-'));
  return {
    directory,
    databaseUrl: `file:${join(directory, 'test.db')}`,
    preMigrationFolder: join(directory, 'pre-migrations'),
  };
}

describe('workout sets semantics migration', () => {
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

  async function countSets(client: Client): Promise<number> {
    const result = await client.execute('SELECT COUNT(*) AS count FROM workout_sets');
    return Number(result.rows[0]?.count);
  }

  it('adds the six nullable semantic columns with the expected declared types', async () => {
    const client = await migrateOldThenNew();

    try {
      const columns = await client.execute("PRAGMA table_info('workout_sets')");
      const byName = new Map(columns.rows.map((row) => [String(row.name), row]));

      for (const column of NEW_COLUMNS) {
        const row = byName.get(column);
        expect(row).toBeDefined();
        expect(Number(row?.notnull)).toBe(0);
      }

      expect(String(byName.get('semantic_capture_version')?.type).toLowerCase()).toBe('integer');
      for (const column of ['load_mode', 'amount_basis', 'side', 'set_purpose', 'rep_count_basis']) {
        expect(String(byName.get(column)?.type).toLowerCase()).toBe('text');
      }
    } finally {
      client.close();
    }
  });

  it('leaves the legacy row byte-for-byte unchanged with all six semantics NULL', async () => {
    const client = await migrateOldThenNew();

    try {
      const result = await client.execute(
        'SELECT weight_kg, semantic_capture_version, load_mode, amount_basis, side, set_purpose, rep_count_basis FROM workout_sets WHERE id = 1',
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toMatchObject({
        weight_kg: '80.5',
        semantic_capture_version: null,
        load_mode: null,
        amount_basis: null,
        side: null,
        set_purpose: null,
        rep_count_basis: null,
      });
    } finally {
      client.close();
    }
  });

  it('creates the external PR cohort index as a non-unique partial index', async () => {
    const client = await migrateOldThenNew();

    try {
      const indexes = await client.execute("PRAGMA index_list('workout_sets')");
      const cohort = indexes.rows.find(
        (row) => String(row.name) === 'workout_sets_external_pr_cohort_idx',
      );
      expect(cohort).toBeDefined();
      expect(Number(cohort?.unique)).toBe(0);
      expect(Number(cohort?.partial)).toBe(1);
    } finally {
      client.close();
    }
  });

  it('accepts valid v1 tuples including bodyweight and alternating', async () => {
    const client = await migrateOldThenNew();

    try {
      await expect(
        client.execute(
          "INSERT INTO workout_sets (workout_id, exercise_id, set_index, reps, weight_kg, completed, semantic_capture_version, load_mode, amount_basis, side, set_purpose) VALUES (1, 1, 2, 8, '80.5', 1, 1, 'external', 'total', 'bilateral', 'working')",
        ),
      ).resolves.toBeDefined();

      await expect(
        client.execute(
          "INSERT INTO workout_sets (workout_id, exercise_id, set_index, reps, weight_kg, completed, semantic_capture_version, load_mode, amount_basis, side, set_purpose) VALUES (1, 1, 3, 12, '0', 1, 1, 'bodyweight', NULL, 'bilateral', 'working')",
        ),
      ).resolves.toBeDefined();

      await expect(
        client.execute(
          "INSERT INTO workout_sets (workout_id, exercise_id, set_index, reps, weight_kg, completed, semantic_capture_version, load_mode, amount_basis, side, set_purpose, rep_count_basis) VALUES (1, 1, 4, 10, '40', 1, 1, 'external', 'total', 'alternating', 'working', 'per_side')",
        ),
      ).resolves.toBeDefined();
    } finally {
      client.close();
    }
  });

  it('rejects invalid semantic tuples and enum/version violations', async () => {
    const client = await migrateOldThenNew();

    try {
      const cases: string[] = [
        // bodyweight must use the canonical zero sentinel
        "INSERT INTO workout_sets (workout_id, exercise_id, set_index, reps, weight_kg, completed, semantic_capture_version, load_mode, amount_basis, side, set_purpose) VALUES (1, 1, 10, 8, '10', 1, 1, 'bodyweight', NULL, 'bilateral', 'working')",
        // non-bodyweight requires an amount basis
        "INSERT INTO workout_sets (workout_id, exercise_id, set_index, reps, weight_kg, completed, semantic_capture_version, load_mode, amount_basis, side, set_purpose) VALUES (1, 1, 11, 8, '50', 1, 1, 'external', NULL, 'bilateral', 'working')",
        // partially populated tuple (purpose missing) is corrupt
        "INSERT INTO workout_sets (workout_id, exercise_id, set_index, reps, weight_kg, completed, semantic_capture_version, load_mode, amount_basis, side, set_purpose) VALUES (1, 1, 12, 8, '50', 1, 1, 'external', 'total', 'bilateral', NULL)",
        // rep-count basis is forbidden for non-alternating sides
        "INSERT INTO workout_sets (workout_id, exercise_id, set_index, reps, weight_kg, completed, semantic_capture_version, load_mode, amount_basis, side, set_purpose, rep_count_basis) VALUES (1, 1, 13, 8, '50', 1, 1, 'external', 'total', 'bilateral', 'working', 'total')",
        // alternating requires an explicit rep-count basis
        "INSERT INTO workout_sets (workout_id, exercise_id, set_index, reps, weight_kg, completed, semantic_capture_version, load_mode, amount_basis, side, set_purpose, rep_count_basis) VALUES (1, 1, 14, 8, '50', 1, 1, 'external', 'total', 'alternating', 'working', NULL)",
        // enum membership
        "INSERT INTO workout_sets (workout_id, exercise_id, set_index, reps, weight_kg, completed, semantic_capture_version, load_mode, amount_basis, side, set_purpose) VALUES (1, 1, 15, 8, '50', 1, 1, 'magic', 'total', 'bilateral', 'working')",
        // version must be positive
        "INSERT INTO workout_sets (workout_id, exercise_id, set_index, reps, weight_kg, completed, semantic_capture_version, load_mode, amount_basis, side, set_purpose) VALUES (1, 1, 16, 8, '50', 1, 0, 'external', 'total', 'bilateral', 'working')",
      ];

      for (const sql of cases) {
        await expect(client.execute(sql)).rejects.toThrow(/check/i);
      }
    } finally {
      client.close();
    }
  });

  it('accepts a future semantic_capture_version=2 (version-neutral check)', async () => {
    const client = await migrateOldThenNew();

    try {
      await expect(
        client.execute(
          "INSERT INTO workout_sets (workout_id, exercise_id, set_index, reps, weight_kg, completed, semantic_capture_version, load_mode, amount_basis, side, set_purpose) VALUES (1, 1, 20, 5, '90', 1, 2, 'external', 'total', 'bilateral', 'working')",
        ),
      ).resolves.toBeDefined();
    } finally {
      client.close();
    }
  });

  it('re-running the migrator is a no-op and leaves row counts unchanged', async () => {
    const client = await migrateOldThenNew();

    try {
      const before = await countSets(client);
      expect(before).toBe(1);

      await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
      await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });

      expect(await countSets(client)).toBe(before);
    } finally {
      client.close();
    }
  });
});
