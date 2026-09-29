import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { loadLocalEnv } from '../dev/load-local-env';
import * as schema from './schema';
import { resolveAppLibsqlClientConfig } from './client-config';

loadLocalEnv();

/**
 * Options this file hands to `createClient`.
 *
 * Exported so `client.test.ts` can assert the app-wide wiring: dropping the resolved
 * busy timeout here puts local concurrent writes back to failing immediately with
 * `SQLITE_BUSY` (issue #172).
 */
export const libsqlClientConfig = resolveAppLibsqlClientConfig();

const client = createClient(libsqlClientConfig);

export const db = drizzle(client, { schema });
