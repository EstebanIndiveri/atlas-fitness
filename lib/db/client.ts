import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { loadLocalEnv } from '../dev/load-local-env';
import * as schema from './schema';

loadLocalEnv();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:./local.db',
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

export const db = drizzle(client, { schema });
