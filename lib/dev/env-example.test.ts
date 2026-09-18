import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  LOCAL_ENV_OPTIONAL_KEYS,
  LOCAL_ENV_REQUIRED_KEYS,
  LOCAL_FILE_DB_URL,
  parseEnvFile,
} from './load-local-env';

describe('.env.example (local / Box defaults)', () => {
  const examplePath = join(process.cwd(), '.env.example');
  const contents = readFileSync(examplePath, 'utf8');
  const parsed = parseEnvFile(contents);

  it('defaults TURSO_DATABASE_URL to a local file DB (no Turso cloud)', () => {
    expect(parsed.TURSO_DATABASE_URL).toBe(LOCAL_FILE_DB_URL);
    expect(parsed.TURSO_DATABASE_URL).toMatch(/^file:/);
  });

  it('includes required local secrets as placeholders, not live credentials', () => {
    for (const key of LOCAL_ENV_REQUIRED_KEYS) {
      expect(parsed[key]).toBeDefined();
      expect(parsed[key]).not.toBe('');
    }

    expect(parsed.SESSION_SECRET).toMatch(/change-me|local-dev/i);
    expect(parsed.CRON_SECRET).toMatch(/change-me|local-dev/i);
    expect(contents).toMatch(/openssl rand -hex 32/);
  });

  it('documents optional Telegram vars without requiring a real bot', () => {
    for (const key of LOCAL_ENV_OPTIONAL_KEYS) {
      expect(contents).toMatch(new RegExp(`^${key}=`, 'm'));
    }

    expect(parsed.TELEGRAM_BOT_TOKEN).toBe('');
    expect(parsed.TELEGRAM_WEBHOOK_SECRET).toBe('');
    expect(parsed.ALLOW_INSECURE_TELEGRAM_WEBHOOK).toBe('true');
    expect(contents).toMatch(/BotFather|optional/i);
  });

  it('does not commit Turso tokens or Telegram bot tokens', () => {
    expect(parsed.TURSO_AUTH_TOKEN ?? '').toBe('');
    expect(parsed.TELEGRAM_BOT_TOKEN).toBe('');
  });

  it('defaults remote bootstrap confirmation and QA seed controls to empty strings', () => {
    expect(parsed.CONFIRM_REMOTE_DB_BOOTSTRAP).toBe('');
    expect(parsed.SEED_QA_USER).toBe('');
  });

  it('documents optional Turso cloud without changing the file-DB default', () => {
    expect(contents).toMatch(/libsql:\/\/your-database\.turso\.io/);
    expect(contents).toMatch(/Switch back to smoke/i);
    expect(parsed.TURSO_DATABASE_URL).toBe(LOCAL_FILE_DB_URL);
  });

  it('documents real Telegram setWebhook (header secret) as optional', () => {
    expect(contents).toMatch(/setWebhook/);
    expect(contents).toMatch(/X-Telegram-Bot-Api-Secret-Token/);
    expect(contents).toMatch(/ngrok|cloudflared/i);
  });

  it('documents optional Gemini key without requiring a live provider', () => {
    expect(contents).toMatch(/^GEMINI_API_KEY=/m);
    expect(parsed.GEMINI_API_KEY).toBe('');
    expect(contents).toMatch(/fallback/i);
    expect(contents).not.toMatch(/NEXT_PUBLIC_GEMINI/);
  });
});
