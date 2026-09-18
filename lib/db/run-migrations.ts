import { resolve } from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

export async function runLibsqlMigrations(
  url: string,
  authToken?: string,
  migrationsFolder: string = resolve(process.cwd(), 'lib/db/migrations'),
): Promise<void> {
  const client = createClient({
    url,
    authToken,
  });

  try {
    const db = drizzle(client);
    await migrate(db, { migrationsFolder });
  } finally {
    client.close();
  }
}
