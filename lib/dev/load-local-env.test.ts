import { describe, it, expect, afterEach } from '@jest/globals';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  applyEnvDefaults,
  loadLocalEnv,
  parseEnvFile,
} from './load-local-env';

describe('parseEnvFile', () => {
  it('parses KEY=VALUE, skips comments and blank lines', () => {
    const parsed = parseEnvFile(`
# Database
TURSO_DATABASE_URL=file:./local.db

CRON_SECRET=abc123
# comment
SESSION_SECRET="quoted-secret"
TELEGRAM_BOT_TOKEN=
`);

    expect(parsed).toEqual({
      TURSO_DATABASE_URL: 'file:./local.db',
      CRON_SECRET: 'abc123',
      SESSION_SECRET: 'quoted-secret',
      TELEGRAM_BOT_TOKEN: '',
    });
  });

  it('strips export prefix and single quotes', () => {
    const parsed = parseEnvFile(`export NODE_ENV='development'\n`);
    expect(parsed.NODE_ENV).toBe('development');
  });

  it('ignores invalid lines', () => {
    const parsed = parseEnvFile(`=novalue\nNOT A LINE\n_OK=1\n`);
    expect(parsed).toEqual({ _OK: '1' });
  });
});

describe('applyEnvDefaults', () => {
  it('fills missing keys and does not override existing env', () => {
    const env: NodeJS.ProcessEnv = {
      CRON_SECRET: 'from-ci',
    };

    applyEnvDefaults(
      {
        CRON_SECRET: 'from-file',
        SESSION_SECRET: 'from-file',
      },
      env,
    );

    expect(env.CRON_SECRET).toBe('from-ci');
    expect(env.SESSION_SECRET).toBe('from-file');
  });
});

describe('loadLocalEnv', () => {
  const originalCron = process.env.CRON_SECRET;
  let tempDir: string | undefined;

  afterEach(() => {
    if (originalCron === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCron;
    }
    delete process.env.ATLAS_LOAD_ENV_TEST_KEY;
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('loads .env from cwd without overriding process.env', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'atlas-env-'));
    writeFileSync(
      join(tempDir, '.env'),
      'ATLAS_LOAD_ENV_TEST_KEY=from-file\nCRON_SECRET=from-file\n',
      'utf8',
    );

    process.env.CRON_SECRET = 'already-set';
    loadLocalEnv(tempDir);

    expect(process.env.ATLAS_LOAD_ENV_TEST_KEY).toBe('from-file');
    expect(process.env.CRON_SECRET).toBe('already-set');
  });

  it('is a no-op when .env is missing', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'atlas-env-missing-'));
    expect(() => loadLocalEnv(tempDir)).not.toThrow();
  });
});
