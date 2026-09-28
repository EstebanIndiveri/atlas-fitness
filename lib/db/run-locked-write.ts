import { createClient, type Config } from '@libsql/client';
import { resolveLibsqlClientConfig } from './client-config';

const [url, busyTimeoutArg] = process.argv.slice(2);

/**
 * Builds the connection options for the attempt.
 *
 * Without the second argument the fixture writes through the application's own
 * configuration, which is the behaviour under test. Passing an explicit timeout
 * (notably `0`) reproduces the pre-#172 client that gave up the instant another
 * writer held the lock, so the test can prove the wait is what makes the difference.
 */
function buildConfig(): Config {
  if (busyTimeoutArg === undefined) {
    return resolveLibsqlClientConfig(url);
  }

  return { url, timeout: Number(busyTimeoutArg) };
}

/**
 * Test fixture process: writes a row with the application's libsql client.
 *
 * The write has to happen out of process because the local driver performs the lock
 * wait synchronously, which freezes the event loop of whoever issues the statement.
 * Keeping it here lets `client.test.ts` stay responsive and release the lock it holds.
 *
 * Prints `PENDING` just before writing, then `WROTE` or `FAILED <message>`, and exits
 * with code 1 on failure.
 *
 * Usage: `tsx lib/db/run-locked-write.ts <database-url> [busy-timeout-ms]`
 */
async function main(): Promise<void> {
  if (!url) {
    throw new Error('usage: run-locked-write.ts <database-url> [busy-timeout-ms]');
  }

  const client = createClient(buildConfig());

  try {
    process.stdout.write('PENDING\n');
    await client.execute({ sql: "INSERT INTO lock_wait_probe (origin) VALUES ('app')" });
    process.stdout.write('WROTE\n');
  } finally {
    client.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stdout.write(`FAILED ${message}\n`);
  process.exit(1);
});
