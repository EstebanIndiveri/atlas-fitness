import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { createClient } from '@libsql/client';
import { loadLocalEnv } from '../dev/load-local-env';

const runMigrations = async () => {
  loadLocalEnv();

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL || 'file:./local.db',
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });

  const db = drizzle(client);

  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: './lib/db/migrations' });
  console.log('Migrations complete!');

  process.exit(0);
};

runMigrations().catch((err) => {
  console.error('Migration failed!', err);
  process.exit(1);
});
