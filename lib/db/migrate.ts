import { loadLocalEnv } from '../dev/load-local-env';
import { runLibsqlMigrations } from './run-migrations';
import { resolveDatabaseUrl } from './database-url';

const runMigrations = async () => {
  loadLocalEnv();

  const url = resolveDatabaseUrl();
  console.log('Running migrations...');
  await runLibsqlMigrations(url, process.env.TURSO_AUTH_TOKEN || undefined);
  console.log('Migrations complete!');

  process.exit(0);
};

runMigrations().catch((err) => {
  console.error('Migration failed!', err);
  process.exit(1);
});
