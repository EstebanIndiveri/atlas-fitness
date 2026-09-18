import { createClient } from '@libsql/client';

import { loadLocalEnv, LOCAL_FILE_DB_URL } from '../dev/load-local-env';

export const REQUIRED_TABLES = [
  'users',
  'exercises',
  'routines',
  'routine_exercises',
  'workouts',
  'workout_sets',
  'daily_tips',
  'telegram_link_codes',
  'bot_messages',
  'user_streaks',
  'daily_checkins',
  'streak_nudges',
] as const;

export interface DatabaseReadiness {
  ready: boolean;
  missingTables: string[];
}

function getConfiguredDatabaseUrl(): string {
  return process.env.TURSO_DATABASE_URL || LOCAL_FILE_DB_URL;
}

function extractTableNames(rows: unknown[]): string[] {
  const names: string[] = [];

  for (const row of rows) {
    if (typeof row !== 'object' || row === null) {
      continue;
    }

    const name = (row as { name?: unknown }).name;
    if (typeof name === 'string') {
      names.push(name);
    }
  }

  return names;
}

/**
 * Returns the required tables that are not present in the provided set.
 *
 * @param existingTables - Tables already present in the database.
 * @returns Missing required table names in declaration order.
 */
export function findMissingTables(existingTables: Iterable<string>): string[] {
  const existing = new Set(existingTables);
  return REQUIRED_TABLES.filter((table) => !existing.has(table));
}

/**
 * Inspects the configured database and reports whether the application schema is ready.
 *
 * @returns A readiness summary with the missing required tables, if any.
 * @throws If the database cannot be reached or the schema query fails.
 * @example
 * await inspectConfiguredDatabase();
 */
export async function inspectConfiguredDatabase(): Promise<DatabaseReadiness> {
  loadLocalEnv();

  const client = createClient({
    url: getConfiguredDatabaseUrl(),
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });

  try {
    const result = await client.execute(
      "select name from sqlite_master where type = 'table' and name not like 'sqlite_%'",
    );
    const missingTables = findMissingTables(extractTableNames(result.rows));

    return {
      ready: missingTables.length === 0,
      missingTables,
    };
  } finally {
    client.close();
  }
}
