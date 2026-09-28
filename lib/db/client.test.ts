/** @jest-environment node */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createClient, type Client } from '@libsql/client';
import { sql } from 'drizzle-orm';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import {
  DEFAULT_LOCAL_BUSY_TIMEOUT_MS,
  LOCAL_BUSY_TIMEOUT_ENV_KEY,
  resolveLibsqlClientConfig,
  type LibsqlClientConfig,
} from './client-config';

const PROBE_TABLE = 'lock_wait_probe';
const WRITER_SCRIPT = join(process.cwd(), 'lib', 'db', 'run-locked-write.ts');
const LOCK_WAIT_WINDOW_MS = 300;
const TEST_TIMEOUT_MS = 30_000;

/** Outcome of one writer fixture process. */
interface WriterResult {
  code: number | null;
  output: string;
  elapsedMs: number;
}

/** A writer fixture process with the handles used to observe and stop it. */
interface WriterProcess {
  child: ChildProcess;
  /** Resolves when the fixture is about to issue its write. */
  pending: Promise<void>;
  /** Resolves when the fixture has exited, with everything it printed. */
  result: Promise<WriterResult>;
}

/**
 * Resolves when `child` prints `marker`, or rejects if it cannot get that far.
 *
 * @param label How the fixture is named in failure output.
 * @throws If the fixture fails to start or exits before printing the marker.
 */
function waitForMarker(child: ChildProcess, label: string, marker: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      if (stdout.includes(marker)) {
        resolve();
      }
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const fail = (detail: string): void => {
      reject(new Error(`${detail}\nstdout: ${stdout.trim()}\nstderr: ${stderr.trim()}`));
    };

    child.once('error', (error: Error) => {
      fail(`${label} failed to start: ${error.message}`);
    });
    child.once('exit', (code, signal) => {
      fail(`${label} exited early (code=${String(code)}, signal=${String(signal)})`);
    });
  });
}

/**
 * Runs the write in its own OS process.
 *
 * The local driver performs the lock wait synchronously, so a write issued in the Jest
 * process would freeze the event loop for the whole busy timeout: the test could not
 * even release the lock it holds. Keeping the write out of process leaves the test free
 * to observe the wait and decide when the lock becomes available.
 *
 * `tsx` runs through `--import` instead of the `tsx` CLI wrapper so that killing the
 * child kills the real writer rather than a wrapper process.
 *
 * @param url Database to write to.
 * @param busyTimeoutMs Explicit timeout to force; omit to use the application's config.
 * @returns The child process, its "about to write" signal and its result.
 */
function startWriter(url: string, busyTimeoutMs?: number): WriterProcess {
  const args = ['--import', 'tsx', WRITER_SCRIPT, url];
  if (busyTimeoutMs !== undefined) {
    args.push(String(busyTimeoutMs));
  }

  const startedAt = Date.now();
  const child = spawn(process.execPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    // Jest hands each test file its own copy of `process.env`, so a mutation made in a
    // test never reaches a spawned process and the value has to be passed explicitly.
    // Pinning it keeps an ambient `LOCAL_DB_BUSY_TIMEOUT_MS` from shrinking the
    // fixture's wait below the window this suite asserts on.
    env: { ...process.env, [LOCAL_BUSY_TIMEOUT_ENV_KEY]: String(DEFAULT_LOCAL_BUSY_TIMEOUT_MS) },
  });

  let output = '';
  child.stdout?.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });

  const result = new Promise<WriterResult>((resolve, reject) => {
    let settled = false;
    const settle = (settleResult: () => void): void => {
      if (settled) {
        return;
      }

      settled = true;
      settleResult();
    };

    child.once('error', (error: Error) => {
      settle(() => reject(new Error(`lock writer failed to start: ${error.message}`)));
    });
    // `close` rather than `exit`: it fires once stdout has been flushed.
    child.once('close', (code) => {
      settle(() => resolve({ code, output: output.trim(), elapsedMs: Date.now() - startedAt }));
    });
  });

  const pending = waitForMarker(child, 'lock writer', 'PENDING');
  // Tests that expect the writer to fail never await `pending`; without a handler its
  // rejection would surface as an unhandled rejection instead of a test assertion.
  pending.catch(() => undefined);

  return { child, pending, result };
}

/** Kills the fixture process if it is still running and waits for it to be gone. */
async function stopWriter(writer: WriterProcess): Promise<void> {
  const { child } = writer;
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
  }

  await writer.result.catch(() => undefined);
}

/** Resolves after `ms`, keeping the Jest process free while a fixture blocks. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Behavioral coverage for issue #172: a local `file:` database must make the
 * application client wait for a write lock held by another OS process instead of
 * failing immediately with `SQLITE_BUSY`.
 *
 * Every test gets a private database directory and closes its client in `afterEach`.
 * Both tests hold the lock from the moment the writer starts writing until the writer
 * has settled, so no assertion depends on the two processes meeting at a given instant.
 */
describe('local database client lock handling', () => {
  let url: string;
  let temporaryDirectory: string;
  let client: Client;
  let clientDb: LibSQLDatabase;
  let previousBusyTimeout: string | undefined;

  beforeEach(async () => {
    // The suite's own client reads its timeout from the environment, so pin it: an
    // ambient `LOCAL_DB_BUSY_TIMEOUT_MS` smaller than LOCK_WAIT_WINDOW_MS would
    // otherwise turn a valid configuration into a failing test. The fixture process is
    // pinned separately in `startWriter`, which Jest does not forward this copy to.
    previousBusyTimeout = process.env[LOCAL_BUSY_TIMEOUT_ENV_KEY];
    process.env[LOCAL_BUSY_TIMEOUT_ENV_KEY] = String(DEFAULT_LOCAL_BUSY_TIMEOUT_MS);

    temporaryDirectory = mkdtempSync(join(tmpdir(), 'atlas-lock-'));
    url = `file:${join(temporaryDirectory, 'test.db')}`;
    client = createClient(resolveLibsqlClientConfig(url));
    clientDb = drizzle(client);
    await clientDb.run(sql.raw(`CREATE TABLE ${PROBE_TABLE} (origin TEXT NOT NULL)`));
  });

  afterEach(() => {
    client.close();
    rmSync(temporaryDirectory, { recursive: true, force: true });

    if (previousBusyTimeout === undefined) {
      delete process.env[LOCAL_BUSY_TIMEOUT_ENV_KEY];
    } else {
      process.env[LOCAL_BUSY_TIMEOUT_ENV_KEY] = previousBusyTimeout;
    }
  });

  it(
    'waits for a write lock held by another process instead of failing immediately',
    async () => {
      const writer = startWriter(url);

      try {
        await clientDb.transaction(async (tx) => {
          await tx.run(sql.raw(`INSERT INTO ${PROBE_TABLE} (origin) VALUES ('holder')`));
          await writer.pending;
          await delay(LOCK_WAIT_WINDOW_MS);
        });

        const result = await writer.result;
        expect(result.output).toContain('WROTE');
        expect(result.code).toBe(0);
        expect(result.elapsedMs).toBeGreaterThanOrEqual(LOCK_WAIT_WINDOW_MS);
      } finally {
        await stopWriter(writer);
      }

      const rows = await clientDb.all<{ origin: string }>(
        sql.raw(`SELECT origin FROM ${PROBE_TABLE} ORDER BY origin`),
      );
      expect(rows.map((row) => row.origin)).toEqual(['app', 'holder']);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'gives up immediately when the client has no busy timeout',
    async () => {
      const writer = startWriter(url, 0);

      try {
        await clientDb.transaction(async (tx) => {
          await tx.run(sql.raw(`INSERT INTO ${PROBE_TABLE} (origin) VALUES ('holder')`));

          const result = await writer.result;
          expect(result.output).toContain('SQLITE_BUSY');
          expect(result.code).not.toBe(0);
          expect(result.elapsedMs).toBeLessThan(DEFAULT_LOCAL_BUSY_TIMEOUT_MS);
        });
      } finally {
        await stopWriter(writer);
      }

      const rows = await clientDb.all<{ origin: string }>(
        sql.raw(`SELECT origin FROM ${PROBE_TABLE} ORDER BY origin`),
      );
      expect(rows.map((row) => row.origin)).toEqual(['holder']);
    },
    TEST_TIMEOUT_MS,
  );
});

const ORIGINAL_ENV = { ...process.env };

/**
 * Imports the application client from `./client` with a fresh module registry.
 *
 * `@libsql/client` is mocked so the options the app builds can be asserted without
 * opening a real connection and `process.env` is swapped for the caller's values.
 *
 * Prefer a falsy value (`''`) over `undefined` to neutralise a variable: importing
 * `./client` runs `loadLocalEnv()`, which refills any key that is still `undefined`
 * from the developer's `.env` and would otherwise leak into the assertions.
 *
 * @param envOverrides Environment values for this import; `undefined` removes a key.
 * @returns The options `lib/db/client.ts` handed to `createClient`.
 */
async function loadAppClientConfig(
  envOverrides: Record<string, string | undefined>,
): Promise<LibsqlClientConfig> {
  const nextEnv: typeof process.env = { ...ORIGINAL_ENV };
  for (const [key, value] of Object.entries(envOverrides)) {
    if (value === undefined) {
      delete nextEnv[key];
    } else {
      nextEnv[key] = value;
    }
  }
  process.env = nextEnv;

  jest.resetModules();
  const createClientMock = jest.fn((_config: LibsqlClientConfig) => ({ close: jest.fn() }));
  jest.doMock('@libsql/client', () => ({ createClient: createClientMock }));

  try {
    const appClient = await import('./client');

    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(createClientMock).toHaveBeenCalledWith(appClient.libsqlClientConfig);

    return appClient.libsqlClientConfig;
  } finally {
    jest.dontMock('@libsql/client');
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  }
}

/**
 * Guards the wiring in `lib/db/client.ts`, not just the helper it calls: without the
 * resolved timeout the app-wide client goes back to failing immediately with
 * `SQLITE_BUSY` (issue #172).
 */
describe('application database client wiring', () => {
  const APP_URL = 'file:/tmp/atlas-app-client-wiring.db';

  it('builds the application client with the local busy timeout', async () => {
    // `''` rather than `undefined`: an undefined key is refilled from `.env` by
    // `loadLocalEnv()` on import, so only an explicit (falsy) value pins the default.
    const config = await loadAppClientConfig({
      TURSO_DATABASE_URL: APP_URL,
      TURSO_AUTH_TOKEN: '',
      [LOCAL_BUSY_TIMEOUT_ENV_KEY]: '',
    });

    expect(config).toEqual({ url: APP_URL, timeout: DEFAULT_LOCAL_BUSY_TIMEOUT_MS });
  });

  it('builds the application client without a timeout for a remote database', async () => {
    const config = await loadAppClientConfig({
      TURSO_DATABASE_URL: 'libsql://atlas-wiring.turso.io',
      TURSO_AUTH_TOKEN: 'token-123',
      JEST_WORKER_ID: undefined,
    });

    expect(config).toEqual({ url: 'libsql://atlas-wiring.turso.io', authToken: 'token-123' });
    expect('timeout' in config).toBe(false);
  });

  it('honours the busy timeout override end to end', async () => {
    const config = await loadAppClientConfig({
      TURSO_DATABASE_URL: APP_URL,
      [LOCAL_BUSY_TIMEOUT_ENV_KEY]: '1500',
    });

    expect(config.timeout).toBe(1500);
  });
});
