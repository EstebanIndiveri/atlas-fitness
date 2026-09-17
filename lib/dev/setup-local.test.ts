import { describe, it, expect, afterEach } from '@jest/globals';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { copyEnvExampleIfMissing, setupLocal } from './setup-local';

function makeTempCwd(): string {
  return mkdtempSync(join(tmpdir(), 'atlas-setup-'));
}

describe('package.json local scripts', () => {
  it('exposes migrate, seed, setup:local, and dev', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['db:migrate']).toBe('tsx lib/db/migrate.ts');
    expect(pkg.scripts['db:seed']).toBe('tsx lib/db/seed.ts');
    expect(pkg.scripts['setup:local']).toBe('tsx scripts/setup-local.ts');
    expect(pkg.scripts.dev).toMatch(/next dev/);
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
    cwd = makeTempCwd();
    writeFileSync(join(cwd, '.env.example'), 'CRON_SECRET=example\n', 'utf8');

    expect(copyEnvExampleIfMissing(cwd)).toBe('copied');
    expect(readFileSync(join(cwd, '.env'), 'utf8')).toBe('CRON_SECRET=example\n');
  });

  it('does not overwrite an existing .env', () => {
    cwd = makeTempCwd();
    writeFileSync(join(cwd, '.env.example'), 'CRON_SECRET=example\n', 'utf8');
    writeFileSync(join(cwd, '.env'), 'CRON_SECRET=mine\n', 'utf8');

    expect(copyEnvExampleIfMissing(cwd)).toBe('skipped');
    expect(readFileSync(join(cwd, '.env'), 'utf8')).toBe('CRON_SECRET=mine\n');
  });

  it('throws when .env.example is missing', () => {
    cwd = makeTempCwd();
    expect(() => copyEnvExampleIfMissing(cwd)).toThrow(/\.env\.example/);
    expect(existsSync(join(cwd, '.env'))).toBe(false);
  });
});

describe('setupLocal', () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) {
      rmSync(cwd, { recursive: true, force: true });
      cwd = undefined;
    }
  });

  it('copies env if missing then runs migrate and seed in order', async () => {
    cwd = makeTempCwd();
    writeFileSync(join(cwd, '.env.example'), 'CRON_SECRET=example\n', 'utf8');

    const calls: string[] = [];
    await setupLocal(cwd, async (script) => {
      calls.push(script);
    });

    expect(existsSync(join(cwd, '.env'))).toBe(true);
    expect(calls).toEqual(['db:migrate', 'db:seed']);
  });
});
