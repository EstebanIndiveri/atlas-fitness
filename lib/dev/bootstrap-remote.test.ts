import { describe, expect, it } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { delimiter, join } from 'node:path';

import {
  bootstrapRemoteDatabase,
  type RemoteBootstrapScript,
} from './bootstrap-remote';

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

type TestProcessEnv = Record<string, string | undefined> & {
  NODE_ENV: 'development' | 'production' | 'test';
};

const PROJECT_ROOT = process.cwd();
const BOOTSTRAP_SCRIPT = join(PROJECT_ROOT, 'scripts/bootstrap-remote.ts');
const TSX_EXECUTABLE = join(PROJECT_ROOT, 'node_modules/.bin/tsx');

function createDeferred(): Deferred {
  let resolve = (): void => undefined;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function createTestDirectory(prefix: string): string {
  const cacheDir = join(PROJECT_ROOT, 'node_modules/.cache');
  mkdirSync(cacheDir, { recursive: true });
  return mkdtempSync(join(cacheDir, prefix));
}

function writeConfirmedRemoteEnv(testDir: string): void {
  writeFileSync(
    join(testDir, '.env'),
    [
      'TURSO_DATABASE_URL=libsql://atlas.example.turso.io',
      'TURSO_AUTH_TOKEN=from-env-file',
      'CONFIRM_REMOTE_DB_BOOTSTRAP=1',
      'BOOTSTRAP_TEST_MARKER=from-env-file',
      '',
    ].join('\n'),
    'utf8',
  );
}

function createBootstrapProcessEnv(
  overrides: Record<string, string | undefined> = {},
): TestProcessEnv {
  const env: TestProcessEnv = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV,
  };
  delete env.TURSO_DATABASE_URL;
  delete env.TURSO_AUTH_TOKEN;
  delete env.CONFIRM_REMOTE_DB_BOOTSTRAP;
  delete env.BOOTSTRAP_TEST_MARKER;
  return {
    ...env,
    ...overrides,
    NODE_ENV: env.NODE_ENV,
  };
}

describe('bootstrapRemoteDatabase', () => {
  it('rejects a file database', async () => {
    await expect(
      bootstrapRemoteDatabase(
        {
          TURSO_DATABASE_URL: 'file:./local.db',
          TURSO_AUTH_TOKEN: 'configured',
          CONFIRM_REMOTE_DB_BOOTSTRAP: '1',
        },
        async () => undefined,
      ),
    ).rejects.toThrow('requires a libsql:// database');
  });

  it('requires a Turso auth token', async () => {
    await expect(
      bootstrapRemoteDatabase(
        {
          TURSO_DATABASE_URL: 'libsql://atlas.example.turso.io',
          CONFIRM_REMOTE_DB_BOOTSTRAP: '1',
        },
        async () => undefined,
      ),
    ).rejects.toThrow('requires TURSO_AUTH_TOKEN');
  });

  it('requires explicit confirmation', async () => {
    await expect(
      bootstrapRemoteDatabase(
        {
          TURSO_DATABASE_URL: 'libsql://atlas.example.turso.io',
          TURSO_AUTH_TOKEN: 'configured',
        },
        async () => undefined,
      ),
    ).rejects.toThrow('CONFIRM_REMOTE_DB_BOOTSTRAP=1');
  });

  it('runs migrate, system seed, and verification in order', async () => {
    const calls: string[] = [];
    const starts: Record<RemoteBootstrapScript, Deferred> = {
      'db:migrate': createDeferred(),
      'db:seed': createDeferred(),
      'db:verify': createDeferred(),
    };
    const releases: Record<RemoteBootstrapScript, Deferred> = {
      'db:migrate': createDeferred(),
      'db:seed': createDeferred(),
      'db:verify': createDeferred(),
    };

    const bootstrap = bootstrapRemoteDatabase(
      {
        TURSO_DATABASE_URL: 'libsql://atlas.example.turso.io',
        TURSO_AUTH_TOKEN: 'configured',
        CONFIRM_REMOTE_DB_BOOTSTRAP: '1',
      },
      async (script) => {
        calls.push(script);
        starts[script].resolve();
        await releases[script].promise;
      },
    );

    await starts['db:migrate'].promise;
    expect(calls).toEqual(['db:migrate']);

    releases['db:migrate'].resolve();
    await starts['db:seed'].promise;
    expect(calls).toEqual(['db:migrate', 'db:seed']);

    releases['db:seed'].resolve();
    await starts['db:verify'].promise;
    expect(calls).toEqual(['db:migrate', 'db:seed', 'db:verify']);

    releases['db:verify'].resolve();
    await bootstrap;
  });
});

describe('db:bootstrap:remote CLI', () => {
  it('starts and propagates a guard failure through the exit status', () => {
    const result = spawnSync('npm', ['run', 'db:bootstrap:remote'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        TURSO_DATABASE_URL: 'file:./local.db',
        TURSO_AUTH_TOKEN: 'configured',
        CONFIRM_REMOTE_DB_BOOTSTRAP: '1',
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Remote bootstrap requires a libsql:// database');
  });

  it('loads .env and stops after a failed npm script', () => {
    const testDir = createTestDirectory('bootstrap-remote-');
    const binDir = join(testDir, 'bin');
    const logPath = join(testDir, 'npm-calls.jsonl');
    const npmPath = join(binDir, 'npm');

    try {
      mkdirSync(binDir);
      writeConfirmedRemoteEnv(testDir);
      writeFileSync(
        npmPath,
        `#!/usr/bin/env node
const { appendFileSync } = require('node:fs');
const script = process.argv[3];
appendFileSync(
  process.env.BOOTSTRAP_TEST_LOG,
  JSON.stringify({
    script,
    cwd: process.cwd(),
    token: process.env.TURSO_AUTH_TOKEN,
    marker: process.env.BOOTSTRAP_TEST_MARKER,
  }) + '\\n',
);
console.log('fake npm ' + script);
if (script === 'db:seed') {
  process.exit(17);
}
`,
        'utf8',
      );
      chmodSync(npmPath, 0o755);

      const env = createBootstrapProcessEnv({
        BOOTSTRAP_TEST_LOG: logPath,
        PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`,
      });

      const result = spawnSync(
        TSX_EXECUTABLE,
        [BOOTSTRAP_SCRIPT],
        {
          cwd: testDir,
          encoding: 'utf8',
          env,
        },
      );
      const calls = readFileSync(logPath, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as unknown);

      expect(result.status).toBe(1);
      expect(result.stdout).toContain('fake npm db:migrate');
      expect(result.stdout).toContain('fake npm db:seed');
      expect(result.stdout).not.toContain('fake npm db:verify');
      expect(result.stderr).toContain('npm run db:seed failed with exit code 17');
      expect(calls).toEqual([
        {
          script: 'db:migrate',
          cwd: testDir,
          token: 'from-env-file',
          marker: 'from-env-file',
        },
        {
          script: 'db:seed',
          cwd: testDir,
          token: 'from-env-file',
          marker: 'from-env-file',
        },
      ]);
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('propagates npm spawn errors', () => {
    const testDir = createTestDirectory('bootstrap-remote-spawn-');
    const binDir = join(testDir, 'bin');

    try {
      mkdirSync(binDir);
      symlinkSync(process.execPath, join(binDir, 'node'));
      writeConfirmedRemoteEnv(testDir);

      const result = spawnSync(
        TSX_EXECUTABLE,
        [BOOTSTRAP_SCRIPT],
        {
          cwd: testDir,
          encoding: 'utf8',
          env: createBootstrapProcessEnv({ PATH: binDir }),
        },
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('spawn npm ENOENT');
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });
});
