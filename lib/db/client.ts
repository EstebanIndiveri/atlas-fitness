import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { loadLocalEnv } from '../dev/load-local-env';
import * as schema from './schema';
import { resolveDatabaseUrl } from './database-url';

loadLocalEnv();

const client = createClient({
  url: resolveDatabaseUrl(),
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

export const db = drizzle(client, { schema });
