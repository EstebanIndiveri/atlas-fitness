import { randomBytes } from 'node:crypto';
import { createIsolatedTestDatabaseUrl } from './lib/db/test-database';

process.env.TURSO_DATABASE_URL = createIsolatedTestDatabaseUrl();
delete process.env.TURSO_AUTH_TOKEN;

// Tests must be deterministic and never call the live Gemini API. next/jest and
// loadLocalEnv() (invoked when lib/db/client is imported) both read .env, but
// applyEnvDefaults only fills keys that are `undefined`. Setting an empty string
// (not deleting) therefore neutralizes any real GEMINI_API_KEY and blocks the
// refill, so services take the deterministic fallback path by default. Suites
// exercising the Gemini path set their own key and mock fetch explicitly.
process.env.GEMINI_API_KEY = '';

if (!process.env.SESSION_SECRET?.trim()) {
  process.env.SESSION_SECRET = randomBytes(32).toString('hex');
}
