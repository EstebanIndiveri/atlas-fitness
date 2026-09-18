import { randomBytes } from 'node:crypto';
import { createIsolatedTestDatabaseUrl } from './lib/db/test-database';

process.env.TURSO_DATABASE_URL = createIsolatedTestDatabaseUrl();
delete process.env.TURSO_AUTH_TOKEN;

if (!process.env.SESSION_SECRET?.trim()) {
  process.env.SESSION_SECRET = randomBytes(32).toString('hex');
}
