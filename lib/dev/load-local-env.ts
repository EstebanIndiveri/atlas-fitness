import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const LOCAL_FILE_DB_URL = 'file:./local.db';

export const LOCAL_ENV_REQUIRED_KEYS = [
  'TURSO_DATABASE_URL',
  'SESSION_SECRET',
  'CRON_SECRET',
] as const;

export const LOCAL_ENV_OPTIONAL_KEYS = [
  'TURSO_AUTH_TOKEN',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_WEBHOOK_SECRET',
  'GEMINI_API_KEY',
  'NODE_ENV',
  'CONFIRM_REMOTE_DB_BOOTSTRAP',
  'SEED_QA_USER',
] as const;

/**
 * Minimal .env parser for local/Box scripts (tsx does not load Next.js env).
 * Does not expand variables. Existing process.env wins (CI / Playwright).
 */
export function parseEnvFile(contents: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const withoutExport = line.startsWith('export ') ? line.slice('export '.length).trim() : line;
    const eq = withoutExport.indexOf('=');
    if (eq <= 0) {
      continue;
    }

    const key = withoutExport.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }

    let value = withoutExport.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

export function applyEnvDefaults(
  parsed: Record<string, string>,
  env: Record<string, string | undefined> = process.env,
): void {
  for (const [key, value] of Object.entries(parsed)) {
    if (env[key] === undefined) {
      env[key] = value;
    }
  }
}

export function loadLocalEnv(cwd: string = process.cwd()): void {
  const envPath = resolve(cwd, '.env');
  if (!existsSync(envPath)) {
    return;
  }

  const parsed = parseEnvFile(readFileSync(envPath, 'utf8'));
  applyEnvDefaults(parsed);
}
