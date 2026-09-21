import { afterEach, describe, expect, it } from '@jest/globals';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

import { SYSTEM_EXERCISES, SYSTEM_EXERCISE_MIN_COUNT } from './system-exercises';


async function executeMigrationSql(client: ReturnType<typeof createClient>, path: string): Promise<void> {
  const statements = readFileSync(path, 'utf8')
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await client.execute(statement);
  }
}

function makeDatabaseUrl(name: string): { directory: string; url: string } {
  const directory = join(cwd(), `.catalog-test-db-${name}-${Date.now()}`);
  mkdirSync(directory, { recursive: true });
  return { directory, url: `file:${join(directory, 'test.db')}` };
}

describe('curated system exercise catalog', () => {
  const tempDirectories: string[] = [];

  afterEach(() => {
    for (const directory of tempDirectories.splice(0)) {
      if (existsSync(directory)) {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  });

  it('contains a broad es-AR catalog with real images and only validated/null videos', () => {
    expect(SYSTEM_EXERCISES.length).toBeGreaterThanOrEqual(SYSTEM_EXERCISE_MIN_COUNT);

    const slugs = new Set<string>();
    const muscleGroups = new Set(SYSTEM_EXERCISES.map((exercise) => exercise.muscleGroup));
    expect([...muscleGroups]).toEqual(
      expect.arrayContaining(['Pecho', 'Espalda', 'Hombros', 'Piernas', 'Glúteos', 'Bíceps', 'Tríceps', 'Core']),
    );

    for (const exercise of SYSTEM_EXERCISES) {
      expect(exercise.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(slugs.has(exercise.slug)).toBe(false);
      slugs.add(exercise.slug);
      expect(exercise.name).toMatch(/\S/);
      expect(exercise.instructions.length).toBeGreaterThanOrEqual(20);
      expect(exercise.imageUrl).toMatch(
        /^https:\/\/raw\.githubusercontent\.com\/yuhonas\/free-exercise-db\/main\/exercises\/.+\/0\.jpg$/,
      );
      if (exercise.videoUrl !== null) {
        expect(exercise.videoUrl).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/);
      }
      expect(exercise.isSystem).toBe(true);
    }
  });

  it('data migration inserts and updates the curated catalog idempotently', async () => {
    const { directory, url } = makeDatabaseUrl('migration');
    tempDirectories.push(directory);
    const client = createClient({ url });

    try {
      await migrate(drizzle(client), { migrationsFolder: './lib/db/migrations' });
      const first = await client.execute({
        sql: 'SELECT COUNT(*) AS count FROM exercises WHERE is_system = 1',
        args: [],
      });
      expect(Number(first.rows[0]?.count)).toBeGreaterThanOrEqual(SYSTEM_EXERCISE_MIN_COUNT);

      await migrate(drizzle(client), { migrationsFolder: './lib/db/migrations' });
      const second = await client.execute({
        sql: 'SELECT slug, name, muscle_group, instructions, image_url, video_url FROM exercises WHERE is_system = 1 ORDER BY slug',
        args: [],
      });
      expect(second.rows).toHaveLength(Number(first.rows[0]?.count));

      for (const exercise of SYSTEM_EXERCISES) {
        const row = second.rows.find((candidate) => candidate.slug === exercise.slug);
        expect(row).toMatchObject({
          slug: exercise.slug,
          name: exercise.name,
          muscle_group: exercise.muscleGroup,
          instructions: exercise.instructions,
          image_url: exercise.imageUrl,
          video_url: exercise.videoUrl,
        });
      }
    } finally {
      client.close();
    }
  });
  it('renames colliding custom slugs before inserting system catalog rows', async () => {
    const { directory, url } = makeDatabaseUrl('collision');
    tempDirectories.push(directory);
    const client = createClient({ url });

    try {
      await migrate(drizzle(client), { migrationsFolder: './lib/db/migrations' });
      await client.execute({
        sql: "INSERT INTO users (name, email, password_hash) VALUES ('User', 'collision@test.com', 'hash')",
        args: [],
      });
      await client.execute({
        sql: "DELETE FROM exercises WHERE slug = 'pull-up' AND is_system = 1",
        args: [],
      });
      await client.execute({
        sql: "INSERT INTO exercises (slug, name, muscle_group, instructions, is_system, user_id) VALUES ('pull-up', 'Mi dominada', 'Espalda', 'Custom', 0, 1)",
        args: [],
      });

      await executeMigrationSql(client, './lib/db/migrations/0018_system_exercise_catalog.sql');

      const rows = await client.execute({
        sql: "SELECT slug, name, is_system, user_id FROM exercises WHERE slug LIKE 'pull-up%' ORDER BY is_system, slug",
        args: [],
      });
      expect(rows.rows).toHaveLength(2);
      expect(String(rows.rows[0]?.slug)).toMatch(/^pull-up-custom-\d+$/);
      expect(rows.rows[0]).toMatchObject({ name: 'Mi dominada', is_system: 0, user_id: 1 });
      expect(rows.rows[1]).toMatchObject({ slug: 'pull-up', name: 'Dominadas', is_system: 1, user_id: null });
    } finally {
      client.close();
    }
  });

});
