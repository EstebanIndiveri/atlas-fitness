import { describe, it, expect, afterEach } from '@jest/globals';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LOCAL_FILE_DB_URL } from './load-local-env';
import { copyEnvExampleIfMissing, setupLocal } from './setup-local';

function makeTempCwd(): string {
  return mkdtempSync(join(tmpdir(), 'atlas-setup-'));
}

describe('package.json local scripts', () => {
  it('exposes migrate, system seed, QA seed, setup:local, and dev', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['db:migrate']).toBe('tsx lib/db/migrate.ts');
    expect(pkg.scripts['db:seed']).toBe('tsx lib/db/seed.ts');
    expect(pkg.scripts['db:seed:qa']).toBe('tsx scripts/seed-qa.ts');
    expect(pkg.scripts['setup:local']).toBe('tsx scripts/setup-local.ts');
    expect(pkg.scripts.dev).toMatch(/next dev/);
  });
});

describe('scripts/setup-local.ts', () => {
  it('does not log the QA password', () => {
    const script = readFileSync(join(process.cwd(), 'scripts/setup-local.ts'), 'utf8');
    expect(script).not.toContain('Test1234!');
  });
});

describe('copyEnvExampleIfMissing', () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) {
      rmSync(cwd, { recursive: true, force: true });
      cwd = undefined;
    }
  });

  it('copies .env.example to .env when .env is missing', () => {
    const dir = makeTempCwd();
    cwd = dir;
    writeFileSync(join(dir, '.env.example'), 'CRON_SECRET=example\n', 'utf8');

    expect(copyEnvExampleIfMissing(dir)).toBe('copied');
    expect(readFileSync(join(dir, '.env'), 'utf8')).toBe('CRON_SECRET=example\n');
  });

  it('does not overwrite an existing .env', () => {
    const dir = makeTempCwd();
    cwd = dir;
    writeFileSync(join(dir, '.env.example'), 'CRON_SECRET=example\n', 'utf8');
    writeFileSync(join(dir, '.env'), 'CRON_SECRET=mine\n', 'utf8');

    expect(copyEnvExampleIfMissing(dir)).toBe('skipped');
    expect(readFileSync(join(dir, '.env'), 'utf8')).toBe('CRON_SECRET=mine\n');
  });

  it('throws when .env.example is missing', () => {
    const dir = makeTempCwd();
    cwd = dir;
    expect(() => copyEnvExampleIfMissing(dir)).toThrow(/\.env\.example/);
    expect(existsSync(join(dir, '.env'))).toBe(false);
  });
});

describe('setupLocal', () => {
  let cwd: string | undefined;
  const originalTursoDatabaseUrl = process.env.TURSO_DATABASE_URL;

  afterEach(() => {
    if (originalTursoDatabaseUrl === undefined) {
      delete process.env.TURSO_DATABASE_URL;
    } else {
      process.env.TURSO_DATABASE_URL = originalTursoDatabaseUrl;
    }

    if (cwd) {
      rmSync(cwd, { recursive: true, force: true });
      cwd = undefined;
    }
  });

  it('copies env if missing then runs migrate and QA seed in order', async () => {
    const dir = makeTempCwd();
    cwd = dir;
    delete process.env.TURSO_DATABASE_URL;
    writeFileSync(join(dir, '.env.example'), `TURSO_DATABASE_URL=${LOCAL_FILE_DB_URL}\nCRON_SECRET=example\n`, 'utf8');

    const calls: string[] = [];
    await setupLocal(dir, async (script) => {
      calls.push(script);
    });

    expect(existsSync(join(dir, '.env'))).toBe(true);
    expect(calls).toEqual(['db:migrate', 'db:seed:qa']);
  });

  it('rejects a non-file TURSO_DATABASE_URL before running migrate or QA seed', async () => {
    const dir = makeTempCwd();
    cwd = dir;
    delete process.env.TURSO_DATABASE_URL;
    writeFileSync(
      join(dir, '.env'),
      'TURSO_DATABASE_URL=libsql://atlas-remote.turso.io\nCRON_SECRET=example\n',
      'utf8',
    );
    writeFileSync(join(dir, '.env.example'), `TURSO_DATABASE_URL=${LOCAL_FILE_DB_URL}\nCRON_SECRET=example\n`, 'utf8');

    const calls: string[] = [];

    await expect(
      setupLocal(dir, async (script) => {
        calls.push(script);
      }),
    ).rejects.toThrow(/setup:local.*file:/i);
    expect(calls).toEqual([]);
  });

  it('accepts custom file URLs and still runs local setup scripts', async () => {
    const dir = makeTempCwd();
    cwd = dir;
    delete process.env.TURSO_DATABASE_URL;
    writeFileSync(
      join(dir, '.env'),
      'TURSO_DATABASE_URL=file:./custom-local.db\nCRON_SECRET=example\n',
      'utf8',
    );
    writeFileSync(join(dir, '.env.example'), `TURSO_DATABASE_URL=${LOCAL_FILE_DB_URL}\nCRON_SECRET=example\n`, 'utf8');

    const calls: string[] = [];
    await setupLocal(dir, async (script) => {
      calls.push(script);
    });

    expect(calls).toEqual(['db:migrate', 'db:seed:qa']);
  });

  it('accepts file URL schemes case-insensitively', async () => {
    const dir = makeTempCwd();
    cwd = dir;
    delete process.env.TURSO_DATABASE_URL;
    writeFileSync(
      join(dir, '.env'),
      'TURSO_DATABASE_URL=FILE:./custom-local.db\nCRON_SECRET=example\n',
      'utf8',
    );
    writeFileSync(join(dir, '.env.example'), `TURSO_DATABASE_URL=${LOCAL_FILE_DB_URL}\nCRON_SECRET=example\n`, 'utf8');

    const calls: string[] = [];
    await setupLocal(dir, async (script) => {
      calls.push(script);
    });

    expect(calls).toEqual(['db:migrate', 'db:seed:qa']);
  });
});
