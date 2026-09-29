import { resolveDatabaseUrl } from './database-url';

/**
 * Env knob that overrides the local SQLite busy timeout, in milliseconds.
 */
export const LOCAL_BUSY_TIMEOUT_ENV_KEY = 'LOCAL_DB_BUSY_TIMEOUT_MS';

/**
 * Busy timeout applied to local `file:` databases when nothing overrides it.
 *
 * Local SQLite has no server-side lock queue: without a busy timeout the driver
 * gives up the instant another connection holds the write lock, which surfaced as
 * intermittent `SQLITE_BUSY` 500s (issue #172). Five seconds comfortably covers the
 * short write bursts of the app, the migrations and the E2E fixtures.
 */
export const DEFAULT_LOCAL_BUSY_TIMEOUT_MS = 5000;

/**
 * Upper bound for the override so a typo cannot turn a request into a long hang.
 * Overrides above it are clamped to it rather than reset to the default.
 */
export const MAX_LOCAL_BUSY_TIMEOUT_MS = 60_000;

/**
 * Options passed to `createClient` from `@libsql/client`.
 */
export interface LibsqlClientConfig {
  url: string;
  authToken?: string;
  timeout?: number;
}

/**
 * Reports whether a database URL points at a local SQLite file instead of a remote
 * libsql server.
 *
 * @param url Database URL, possibly with surrounding whitespace.
 * @returns `true` for `file:` URLs and in-memory databases, `false` otherwise.
 * @example
 * isLocalFileDatabaseUrl('file:./local.db'); // true
 * isLocalFileDatabaseUrl('libsql://atlas.turso.io'); // false
 */
export function isLocalFileDatabaseUrl(url: string): boolean {
  const normalized = url.trim().toLowerCase();
  return normalized === ':memory:' || normalized.startsWith('file:');
}

/**
 * Parses a strictly positive decimal integer in milliseconds.
 *
 * Stricter than `Number` on purpose: inputs such as `2.5` or `12abc` fall back to the
 * default, and numeric literals that only `Number` understands (`0x10`, `1e3`, `+50`)
 * are rejected instead of being silently shrunk to a few milliseconds.
 *
 * @param value Raw env value.
 * @param fallback Value used when the env value is missing or not a decimal integer.
 * @returns A value between 1 and {@link MAX_LOCAL_BUSY_TIMEOUT_MS}.
 */
function parseBoundedTimeoutMs(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return fallback;
  }

  const parsed = Number(trimmed);

  return parsed > 0 ? Math.min(parsed, MAX_LOCAL_BUSY_TIMEOUT_MS) : fallback;
}

/**
 * Resolves the SQLite busy timeout for a database URL.
 *
 * Remote libsql databases get `undefined` because Turso manages locking server side
 * and ignores the client option, so remote behaviour stays untouched.
 *
 * @param url Database URL.
 * @param env Environment values used to override the default, `process.env` by default.
 * @returns Milliseconds to wait for a write lock, or `undefined` when not applicable.
 * @example
 * resolveLocalBusyTimeoutMs('file:./local.db'); // 5000
 * resolveLocalBusyTimeoutMs('libsql://atlas.turso.io'); // undefined
 */
export function resolveLocalBusyTimeoutMs(
  url: string,
  env: Record<string, string | undefined> = process.env,
): number | undefined {
  if (!isLocalFileDatabaseUrl(url)) {
    return undefined;
  }

  return parseBoundedTimeoutMs(env[LOCAL_BUSY_TIMEOUT_ENV_KEY], DEFAULT_LOCAL_BUSY_TIMEOUT_MS);
}

/**
 * Builds the `createClient` options for a database URL.
 *
 * Single source of truth for every libsql client in the app (application queries,
 * migrations and readiness inspection) so all of them wait the same way when a local
 * database file is locked.
 *
 * @param url Database URL.
 * @param authToken Turso auth token; omitted when empty.
 * @param env Environment values used to override the local busy timeout.
 * @returns Options for `createClient`, with `timeout` only for local file databases.
 * @example
 * createClient(resolveLibsqlClientConfig('file:./local.db'));
 */
export function resolveLibsqlClientConfig(
  url: string,
  authToken?: string,
  env: Record<string, string | undefined> = process.env,
): LibsqlClientConfig {
  const busyTimeoutMs = resolveLocalBusyTimeoutMs(url, env);
  const config: LibsqlClientConfig = { url };

  if (authToken) {
    config.authToken = authToken;
  }

  return busyTimeoutMs === undefined ? config : { ...config, timeout: busyTimeoutMs };
}

/**
 * Builds the `createClient` options for the application's shared database client.
 *
 * Exists so the app-wide wiring in `lib/db/client.ts` is a single expression that
 * tests can assert: if the client stops honouring the resolved busy timeout, local
 * concurrent writes go back to failing with `SQLITE_BUSY` (issue #172).
 *
 * @param env Environment values used to resolve the URL, the token and the timeout.
 * @returns Options for the application's `createClient` call.
 * @example
 * resolveAppLibsqlClientConfig({ TURSO_DATABASE_URL: 'file:./local.db' });
 * // { url: 'file:./local.db', timeout: 5000 }
 */
export function resolveAppLibsqlClientConfig(
  env: Record<string, string | undefined> = process.env,
): LibsqlClientConfig {
  return resolveLibsqlClientConfig(resolveDatabaseUrl(env), env.TURSO_AUTH_TOKEN || undefined, env);
}
