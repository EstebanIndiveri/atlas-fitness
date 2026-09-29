import { resolve } from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { resolveLibsqlClientConfig } from './client-config';

export async function runLibsqlMigrations(
  url: string,
  authToken?: string,
  migrationsFolder: string = resolve(process.cwd(), 'lib/db/migrations'),
): Promise<void> {
  const client = createClient(resolveLibsqlClientConfig(url, authToken));

  try {
    const db = drizzle(client);
    await migrate(db, { migrationsFolder });
  } finally {
    client.close();
  }
}
