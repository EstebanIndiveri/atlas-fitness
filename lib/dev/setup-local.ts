import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { loadLocalEnv, LOCAL_FILE_DB_URL } from './load-local-env';

export type EnvCopyResult = 'copied' | 'skipped';

export type SetupScript = 'db:migrate' | 'db:seed:qa';

export type ScriptRunner = (script: SetupScript, cwd: string) => Promise<void>;

export function copyEnvExampleIfMissing(cwd: string): EnvCopyResult {
  const envPath = join(cwd, '.env');
  const examplePath = join(cwd, '.env.example');

  if (existsSync(envPath)) {
    return 'skipped';
  }

  if (!existsSync(examplePath)) {
    throw new Error('Missing .env.example; cannot create .env');
  }

  copyFileSync(examplePath, envPath);
  return 'copied';
}

export function runNpmScript(script: SetupScript, cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', script], {
      cwd,
      stdio: 'inherit',
      env: process.env,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`npm run ${script} failed with exit code ${code ?? 'null'}`));
    });
  });
}

function assertSetupLocalDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
): void {
  const databaseUrl = env.TURSO_DATABASE_URL?.trim() ?? '';

  if (databaseUrl.startsWith('file:')) {
    return;
  }

  throw new Error(
    `setup:local only supports file: TURSO_DATABASE_URL values. Reset .env to ${LOCAL_FILE_DB_URL} or use the remote bootstrap commands instead.`,
  );
}

/**
 * One-shot local/Box setup: copy `.env` if missing, migrate file DB, seed QA user.
 */
export async function setupLocal(
  cwd: string = process.cwd(),
  run: ScriptRunner = runNpmScript,
): Promise<EnvCopyResult> {
  const copyResult = copyEnvExampleIfMissing(cwd);
  if (copyResult === 'copied') {
    console.log('Created .env from .env.example');
  } else {
    console.log('.env already exists — leaving it unchanged');
  }

  loadLocalEnv(cwd);
  assertSetupLocalDatabaseUrl();

  await run('db:migrate', cwd);
  await run('db:seed:qa', cwd);
  return copyResult;
}
