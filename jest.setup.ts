import { beforeAll } from '@jest/globals';
import { runLibsqlMigrations } from './lib/db/run-migrations';
import { assertSafeTestDatabaseUrl } from './lib/db/test-database';

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  throw new Error('Jest setup: TURSO_DATABASE_URL is missing');
}
assertSafeTestDatabaseUrl(url);

const migrated = runLibsqlMigrations(url);

beforeAll(async () => {
  await migrated;
});
