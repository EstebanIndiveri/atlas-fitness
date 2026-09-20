export type RemoteBootstrapScript = 'db:migrate' | 'db:seed' | 'db:verify';

export type RemoteBootstrapRunner = (
  script: RemoteBootstrapScript,
) => Promise<void>;

/**
 * Validates an explicitly confirmed remote Turso target and bootstraps it.
 *
 * @param env - Environment containing the remote database configuration.
 * @param run - Runner used to execute each database npm script.
 * @returns A promise that resolves after migration, seed, and verification finish.
 * @throws If the database is not remote, the token is missing, confirmation is absent,
 * or a database script fails.
 * @example
 * await bootstrapRemoteDatabase(process.env, async (script) => {
 *   await runNpmScript(script);
 * });
 */
export async function bootstrapRemoteDatabase(
  env: Record<string, string | undefined>,
  run: RemoteBootstrapRunner,
): Promise<void> {
  const url = env.TURSO_DATABASE_URL?.trim() ?? '';

  if (!url.startsWith('libsql://')) {
    throw new Error('Remote bootstrap requires a libsql:// database');
  }
  if (!env.TURSO_AUTH_TOKEN?.trim()) {
    throw new Error('Remote bootstrap requires TURSO_AUTH_TOKEN');
  }
  if (env.CONFIRM_REMOTE_DB_BOOTSTRAP !== '1') {
    throw new Error('Set CONFIRM_REMOTE_DB_BOOTSTRAP=1 to confirm remote bootstrap');
  }

  for (const script of ['db:migrate', 'db:seed', 'db:verify'] as const) {
    await run(script);
  }
}
