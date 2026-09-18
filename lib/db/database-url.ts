const LOCAL_DB_NAME = 'local.db';

export function isJestRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.JEST_WORKER_ID !== undefined;
}

/**
 * URLs that must never be used by `npm test`: the shared file DB or a remote Turso.
 */
export function isUnsafeTestDatabaseUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) {
    return true;
  }

  const lower = trimmed.toLowerCase();
  if (lower.includes(LOCAL_DB_NAME)) {
    return true;
  }

  return (
    lower.startsWith('libsql://') ||
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('ws://') ||
    lower.startsWith('wss://')
  );
}

export function assertSafeTestDatabaseUrl(url: string): void {
  if (isUnsafeTestDatabaseUrl(url)) {
    throw new Error(
      `Tests refuse TURSO_DATABASE_URL="${url}". Use an isolated temp file under /tmp (or :memory:), never file:./local.db or a Turso URL.`,
    );
  }
}

export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.TURSO_DATABASE_URL?.trim();

  if (isJestRuntime(env)) {
    if (!configured) {
      throw new Error(
        'Tests require TURSO_DATABASE_URL pointing to an isolated temp database',
      );
    }
    assertSafeTestDatabaseUrl(configured);
    return configured;
  }

  return configured || 'file:./local.db';
}
