# Turso Bootstrap and Login Resilience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize remote Turso databases safely, keep the known QA account out of production seeds, and return an actionable 503 instead of an opaque login 500 when the schema is unavailable.

**Architecture:** Keep Drizzle migrations as the schema source of truth. Add an explicit remote bootstrap command that runs migrations, applies only system seed data by default, and verifies required tables before success. Classify nested libSQL “no such table” failures centrally so API routes expose a generic service-unavailable response while preserving detailed server logs.

**Tech Stack:** Next.js 16 Route Handlers, TypeScript 6, Drizzle ORM, `@libsql/client`, Jest 30, npm scripts.

---

## Confirmed root cause

The current `.env` connects successfully to Turso, but the selected database has
zero application tables and no migration table. Calling `login()` produces:

```text
LibsqlError
code: SQLITE_UNKNOWN
cause: SQLite error: no such table: users
```

`lib/services/auth.ts:91-106` already returns `UNAUTHORIZED` when a healthy
`users` table contains no matching email. Therefore, a missing user would
produce HTTP 401; the observed HTTP 500 is caused by an uninitialized database
schema.

The existing recovery documented in `docs/engineering/local-dev.md:182-190` is
`npm run db:migrate` followed by `npm run db:seed`. The hardening work below
prevents this operational step from being forgotten or misused in production.

## File structure

| File | Responsibility |
|---|---|
| `lib/db/errors.ts` | Detect nested libSQL missing-schema errors without coupling routes to provider error classes |
| `lib/db/errors.test.ts` | Cover wrapped and unrelated database errors |
| `lib/auth/middleware.test.ts` | Verify API mapping to 503, existing `AppError` statuses, and generic 500 |
| `types/errors.ts` | Add the public `SERVICE_UNAVAILABLE` error code |
| `lib/auth/middleware.ts` | Centralize safe HTTP mapping and server-only logging |
| `lib/db/seed-options.ts` | Decide whether the known QA account may be seeded |
| `lib/db/seed-options.test.ts` | Cover default, explicit QA, and production rejection |
| `scripts/seed-qa.ts` | Explicit local/CI entry point for QA seed data |
| `lib/db/seed.ts` | Seed system catalog always and QA account only when explicitly enabled |
| `lib/db/readiness.ts` | Compare actual tables against the required application schema |
| `lib/db/readiness.test.ts` | Test ready and missing-table calculations |
| `scripts/verify-database.ts` | Verify the configured database without printing credentials |
| `lib/dev/bootstrap-remote.ts` | Validate explicit remote-bootstrap confirmation and command order |
| `lib/dev/bootstrap-remote.test.ts` | Cover target/confirmation guards and command sequence |
| `scripts/bootstrap-remote.ts` | CLI wrapper for migrate → system seed → verify |
| `lib/dev/setup-local.ts` | Use the explicit QA seed command for local setup |
| `lib/dev/setup-local.test.ts` | Lock script names and local setup sequence |
| `package.json` | Expose `db:seed:qa`, `db:verify`, and `db:bootstrap:remote` |
| `.github/workflows/ci.yml` | Use QA seed only in isolated E2E |
| `docs/engineering/local-dev.md` | Document remote dev versus production bootstrap |
| `README.md` | Link the safe bootstrap workflow |
| `lib/dev/load-local-env.ts` | Classify bootstrap controls as documented optional environment keys |
| `lib/dev/local-dev-docs.test.ts` | Prevent documentation from regressing |

### Task 1: Validate credentials and establish a safe execution baseline

**Files:**
- Modify locally only: `.env`
- Do not commit: `.env`

- [ ] **Step 1: Validate provider credentials without printing their values**

Run read-only checks against Turso (`select 1`), Telegram (`getMe`) and Gemini
(`models`). Continue while all three authenticate successfully. Rotate a
provider credential only if its check fails or the project owner explicitly
requests rotation.

Expected: Turso, Telegram and Gemini each report a successful authenticated
response.

- [ ] **Step 2: Generate three independent application secrets**

Run the command three separate times:

```bash
openssl rand -hex 32
```

Store one distinct result in each local variable:

```text
SESSION_SECRET
CRON_SECRET
TELEGRAM_WEBHOOK_SECRET
```

Expected: each value is 64 hexadecimal characters and no value is reused.

- [ ] **Step 3: Verify `.env` remains outside Git**

Run:

```bash
git check-ignore -v .env
git ls-files --error-unmatch .env
```

Expected: the first command reports `.gitignore`; the second exits non-zero
because `.env` is not tracked.

- [ ] **Step 4: Start implementation from an isolated branch/worktree**

Use `superpowers:using-git-worktrees` from `develop`, then create:

```text
fix/turso-bootstrap-login
```

Expected: the implementation checkout is clean and based on current
`upstream/develop`.

### Task 2: Classify missing database schema errors

**Files:**
- Create: `lib/db/errors.ts`
- Create: `lib/db/errors.test.ts`

- [ ] **Step 1: Write the failing classifier tests**

Create `lib/db/errors.test.ts`:

```ts
import { describe, expect, it } from '@jest/globals';
import { isMissingDatabaseSchemaError } from './errors';

describe('isMissingDatabaseSchemaError', () => {
  it('detects a libSQL no-such-table error wrapped by Drizzle', () => {
    const cause = Object.assign(
      new Error('SQLITE_UNKNOWN: SQLite error: no such table: users'),
      { code: 'SQLITE_UNKNOWN' },
    );
    const error = new Error('Failed query: select from users', { cause });

    expect(isMissingDatabaseSchemaError(error)).toBe(true);
  });

  it('detects a direct no-such-table error', () => {
    expect(
      isMissingDatabaseSchemaError(
        new Error('SQLITE_UNKNOWN: SQLite error: no such table: workouts'),
      ),
    ).toBe(true);
  });

  it('does not classify unrelated database failures as missing schema', () => {
    expect(isMissingDatabaseSchemaError(new Error('connection timeout'))).toBe(false);
    expect(isMissingDatabaseSchemaError(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npm test -- lib/db/errors.test.ts
```

Expected: FAIL because `./errors` does not exist.

- [ ] **Step 3: Implement the nested-cause classifier**

Create `lib/db/errors.ts`:

```ts
function errorMessages(error: unknown): string[] {
  const messages: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;

  while (current instanceof Error && !seen.has(current)) {
    seen.add(current);
    messages.push(current.message);
    current = current.cause;
  }

  return messages;
}

export function isMissingDatabaseSchemaError(error: unknown): boolean {
  return errorMessages(error).some((message) =>
    message.toLowerCase().includes('no such table'),
  );
}
```

- [ ] **Step 4: Run the classifier tests**

Run:

```bash
npm test -- lib/db/errors.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/db/errors.ts lib/db/errors.test.ts
git commit -m "fix: classify missing database schema errors"
```

### Task 3: Return HTTP 503 for an unavailable schema

**Files:**
- Modify: `types/errors.ts:1-10`
- Modify: `lib/auth/middleware.ts:33-54`
- Create: `lib/auth/middleware.test.ts`

- [ ] **Step 1: Write failing HTTP mapping tests**

Create `lib/auth/middleware.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import { handleApiError } from './middleware';
import { AppError } from '@/types/errors';

describe('handleApiError', () => {
  it('returns 503 without leaking schema details for a missing table', async () => {
    const cause = new Error('SQLITE_UNKNOWN: SQLite error: no such table: users');
    const response = handleApiError(new Error('Failed query', { cause }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Servicio temporalmente no disponible',
    });
  });

  it('preserves domain error mappings', async () => {
    const response = handleApiError(
      new AppError('UNAUTHORIZED', 'Email o contraseña inválidos'),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      code: 'UNAUTHORIZED',
      message: 'Email o contraseña inválidos',
    });
  });

  it('keeps unrelated programmer errors as generic 500 responses', async () => {
    const response = handleApiError(new Error('unexpected'));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npm test -- lib/auth/middleware.test.ts
```

Expected: the missing-table case receives 500 instead of 503.

- [ ] **Step 3: Add the public error code**

Extend `ErrorCode` in `types/errors.ts`:

```ts
export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'SERVICE_UNAVAILABLE';
```

- [ ] **Step 4: Map missing schema errors before generic 500**

Import the classifier in `lib/auth/middleware.ts`:

```ts
import { isMissingDatabaseSchemaError } from '@/lib/db/errors';
```

Add this block after the `AppError` branch:

```ts
if (isMissingDatabaseSchemaError(error)) {
  console.error('Database schema is unavailable');
  return NextResponse.json(
    {
      code: 'SERVICE_UNAVAILABLE',
      message: 'Servicio temporalmente no disponible',
    },
    { status: 503 },
  );
}
```

Add the new status to the existing map:

```ts
SERVICE_UNAVAILABLE: 503,
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test -- lib/db/errors.test.ts lib/auth/middleware.test.ts lib/services/auth.test.ts
```

Expected: all focused tests PASS; nonexistent users still produce
`UNAUTHORIZED`, while missing tables produce 503.

- [ ] **Step 6: Commit**

```bash
git add types/errors.ts lib/auth/middleware.ts lib/auth/middleware.test.ts
git commit -m "fix: surface unavailable database schema"
```

### Task 4: Make QA seeding explicit and production-safe

**Files:**
- Create: `lib/db/seed-options.ts`
- Create: `lib/db/seed-options.test.ts`
- Create: `scripts/seed-qa.ts`
- Modify: `lib/db/seed.ts:151-257`
- Modify: `package.json:6-18`
- Modify: `lib/dev/setup-local.ts:8-65`
- Modify: `lib/dev/setup-local.test.ts:11-83`
- Modify: `.github/workflows/ci.yml:71-74`

- [ ] **Step 1: Write failing seed-mode tests**

Create `lib/db/seed-options.test.ts`:

```ts
import { describe, expect, it } from '@jest/globals';
import { shouldSeedQaUser } from './seed-options';

describe('shouldSeedQaUser', () => {
  it('omits the QA account by default', () => {
    expect(shouldSeedQaUser({ NODE_ENV: 'development' })).toBe(false);
  });

  it('allows the QA account when explicitly enabled outside production', () => {
    expect(
      shouldSeedQaUser({
        NODE_ENV: 'test',
        SEED_QA_USER: 'true',
      }),
    ).toBe(true);
  });

  it('rejects the known QA account in production', () => {
    expect(() =>
      shouldSeedQaUser({
        NODE_ENV: 'production',
        SEED_QA_USER: 'true',
      }),
    ).toThrow('QA seed is forbidden in production');
  });
});
```

- [ ] **Step 2: Run the seed-mode test and verify RED**

Run:

```bash
npm test -- lib/db/seed-options.test.ts
```

Expected: FAIL because `seed-options.ts` does not exist.

- [ ] **Step 3: Implement seed-mode selection**

Create `lib/db/seed-options.ts`:

```ts
export function shouldSeedQaUser(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const enabled = env.SEED_QA_USER === 'true';

  if (enabled && env.NODE_ENV === 'production') {
    throw new Error('QA seed is forbidden in production');
  }

  return enabled;
}
```

- [ ] **Step 4: Gate QA-specific rows in the existing seed**

Import the helper in `lib/db/seed.ts`:

```ts
import { shouldSeedQaUser } from './seed-options';
```

At the start of `seed()`:

```ts
const includeQaUser = shouldSeedQaUser();
let userId: number | null = null;
```

Wrap the existing QA user create/update block and streak initialization:

```ts
if (includeQaUser) {
  console.log('Creating QA user...');
  const passwordHash = await bcrypt.hash(QA_USER_PASSWORD, 10);
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, QA_USER_EMAIL),
  });

  if (existingUser) {
    await db
      .update(users)
      .set({ passwordHash, name: 'QA Test User' })
      .where(eq(users.id, existingUser.id));
    userId = existingUser.id;
  } else {
    const [newUser] = await db
      .insert(users)
      .values({
        name: 'QA Test User',
        email: QA_USER_EMAIL,
        passwordHash,
      })
      .returning();
    userId = newUser.id;
  }
}
```

Keep system exercises, routines, and tips outside that condition. Initialize
the streak only when `userId !== null`:

```ts
if (userId !== null) {
  const existingStreak = await db.query.userStreaks.findFirst({
    where: eq(userStreaks.userId, userId),
  });

  if (!existingStreak) {
    await db.insert(userStreaks).values({
      userId,
      currentStreak: 0,
      longestStreak: 0,
      lastWorkoutDate: null,
    });
  }
}
```

Remove console output that prints the known QA password.

- [ ] **Step 5: Add the explicit QA wrapper**

Create `scripts/seed-qa.ts`:

```ts
process.env.SEED_QA_USER = 'true';

await import('../lib/db/seed');
```

- [ ] **Step 6: Update package scripts**

Set:

```json
{
  "db:seed": "tsx lib/db/seed.ts",
  "db:seed:qa": "tsx scripts/seed-qa.ts"
}
```

- [ ] **Step 7: Update local setup and CI**

Change `SetupScript` in `lib/dev/setup-local.ts`:

```ts
export type SetupScript = 'db:migrate' | 'db:seed:qa';
```

Change the second setup command:

```ts
await run('db:seed:qa', cwd);
```

Update assertions in `lib/dev/setup-local.test.ts`:

```ts
expect(pkg.scripts['db:seed:qa']).toBe('tsx scripts/seed-qa.ts');
expect(calls).toEqual(['db:migrate', 'db:seed:qa']);
```

Change the E2E seed step in `.github/workflows/ci.yml`:

```yaml
- name: Seed database with QA user
  run: npm run db:seed:qa
  env:
    TURSO_DATABASE_URL: file:./local.db
    NODE_ENV: test
```

- [ ] **Step 8: Run focused tests**

Run:

```bash
npm test -- lib/db/seed-options.test.ts lib/dev/setup-local.test.ts
```

Expected: all tests PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/db/seed-options.ts lib/db/seed-options.test.ts scripts/seed-qa.ts lib/db/seed.ts package.json lib/dev/setup-local.ts lib/dev/setup-local.test.ts .github/workflows/ci.yml
git commit -m "fix: separate system and QA database seeds"
```

### Task 5: Add database readiness verification

**Files:**
- Create: `lib/db/readiness.ts`
- Create: `lib/db/readiness.test.ts`
- Create: `scripts/verify-database.ts`
- Modify: `package.json:6-18`

- [ ] **Step 1: Write failing readiness tests**

Create `lib/db/readiness.test.ts`:

```ts
import { describe, expect, it } from '@jest/globals';
import { REQUIRED_TABLES, findMissingTables } from './readiness';

describe('findMissingTables', () => {
  it('returns no missing tables for a complete schema', () => {
    expect(findMissingTables(REQUIRED_TABLES)).toEqual([]);
  });

  it('returns every required table absent from the database', () => {
    expect(findMissingTables(['users', 'workouts'])).toEqual(
      REQUIRED_TABLES.filter((name) => name !== 'users' && name !== 'workouts'),
    );
  });
});
```

- [ ] **Step 2: Run the readiness test and verify RED**

Run:

```bash
npm test -- lib/db/readiness.test.ts
```

Expected: FAIL because `readiness.ts` does not exist.

- [ ] **Step 3: Implement required-table comparison and remote inspection**

Create `lib/db/readiness.ts`:

```ts
import { createClient } from '@libsql/client';
import { loadLocalEnv } from '../dev/load-local-env';

export const REQUIRED_TABLES = [
  'users',
  'exercises',
  'routines',
  'routine_exercises',
  'workouts',
  'workout_sets',
  'daily_tips',
  'telegram_link_codes',
  'bot_messages',
  'user_streaks',
  'daily_checkins',
  'streak_nudges',
] as const;

export interface DatabaseReadiness {
  ready: boolean;
  missingTables: string[];
}

export function findMissingTables(existingTables: Iterable<string>): string[] {
  const existing = new Set(existingTables);
  return REQUIRED_TABLES.filter((table) => !existing.has(table));
}

export async function inspectConfiguredDatabase(): Promise<DatabaseReadiness> {
  loadLocalEnv();
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL || 'file:./local.db',
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });

  try {
    const result = await client.execute(
      "select name from sqlite_master where type = 'table' and name not like 'sqlite_%'",
    );
    const names = result.rows
      .map((row) => row.name)
      .filter((name): name is string => typeof name === 'string');
    const missingTables = findMissingTables(names);
    return { ready: missingTables.length === 0, missingTables };
  } finally {
    client.close();
  }
}
```

- [ ] **Step 4: Add a credential-safe verification CLI**

Create `scripts/verify-database.ts`:

```ts
import { inspectConfiguredDatabase } from '../lib/db/readiness';

const result = await inspectConfiguredDatabase();

if (!result.ready) {
  console.error(`Database is missing required tables: ${result.missingTables.join(', ')}`);
  process.exit(1);
}

console.log('Database schema is ready.');
```

Do not print URL, token, user rows, or `.env` values.

- [ ] **Step 5: Expose the verification command**

Add to `package.json`:

```json
"db:verify": "tsx scripts/verify-database.ts"
```

- [ ] **Step 6: Run RED against an empty temporary database**

Run:

```bash
rm -f /tmp/atlas-empty-readiness.db
TURSO_DATABASE_URL=file:/tmp/atlas-empty-readiness.db npm run db:verify
```

Expected: exit 1 and a list of missing application tables.

- [ ] **Step 7: Run GREEN after migrations**

Run:

```bash
TURSO_DATABASE_URL=file:/tmp/atlas-empty-readiness.db npm run db:migrate
TURSO_DATABASE_URL=file:/tmp/atlas-empty-readiness.db npm run db:verify
```

Expected: `Database schema is ready.`

- [ ] **Step 8: Run unit tests**

Run:

```bash
npm test -- lib/db/readiness.test.ts
```

Expected: all readiness tests PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/db/readiness.ts lib/db/readiness.test.ts scripts/verify-database.ts package.json
git commit -m "feat: add database readiness verification"
```

### Task 6: Add an explicit remote bootstrap command

**Files:**
- Create: `lib/dev/bootstrap-remote.ts`
- Create: `lib/dev/bootstrap-remote.test.ts`
- Create: `scripts/bootstrap-remote.ts`
- Modify: `package.json:6-18`

- [ ] **Step 1: Write failing bootstrap guard tests**

Create `lib/dev/bootstrap-remote.test.ts`:

```ts
import { describe, expect, it } from '@jest/globals';
import { bootstrapRemoteDatabase } from './bootstrap-remote';

describe('bootstrapRemoteDatabase', () => {
  it('rejects a file database', async () => {
    await expect(
      bootstrapRemoteDatabase(
        {
          TURSO_DATABASE_URL: 'file:./local.db',
          CONFIRM_REMOTE_DB_BOOTSTRAP: '1',
        },
        async () => undefined,
      ),
    ).rejects.toThrow('requires a libsql:// database');
  });

  it('requires explicit confirmation', async () => {
    await expect(
      bootstrapRemoteDatabase(
        { TURSO_DATABASE_URL: 'libsql://atlas.example.turso.io' },
        async () => undefined,
      ),
    ).rejects.toThrow('CONFIRM_REMOTE_DB_BOOTSTRAP=1');
  });

  it('runs migrate, system seed, and verification in order', async () => {
    const calls: string[] = [];

    await bootstrapRemoteDatabase(
      {
        TURSO_DATABASE_URL: 'libsql://atlas.example.turso.io',
        TURSO_AUTH_TOKEN: 'configured',
        CONFIRM_REMOTE_DB_BOOTSTRAP: '1',
      },
      async (script) => {
        calls.push(script);
      },
    );

    expect(calls).toEqual(['db:migrate', 'db:seed', 'db:verify']);
  });
});
```

- [ ] **Step 2: Run the bootstrap test and verify RED**

Run:

```bash
npm test -- lib/dev/bootstrap-remote.test.ts
```

Expected: FAIL because `bootstrap-remote.ts` does not exist.

- [ ] **Step 3: Implement the guarded workflow**

Create `lib/dev/bootstrap-remote.ts`:

```ts
export type RemoteBootstrapScript = 'db:migrate' | 'db:seed' | 'db:verify';

export type RemoteBootstrapRunner = (
  script: RemoteBootstrapScript,
) => Promise<void>;

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
```

- [ ] **Step 4: Add the CLI wrapper**

Create `scripts/bootstrap-remote.ts`:

```ts
import { spawn } from 'node:child_process';
import { bootstrapRemoteDatabase } from '../lib/dev/bootstrap-remote';
import { loadLocalEnv } from '../lib/dev/load-local-env';

function runNpmScript(script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', script], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    });

    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`npm run ${script} failed with exit code ${code ?? 'null'}`));
    });
  });
}

loadLocalEnv();

await bootstrapRemoteDatabase(process.env, runNpmScript);
console.log('Remote database bootstrap completed.');
```

- [ ] **Step 5: Expose the command**

Add to `package.json`:

```json
"db:bootstrap:remote": "tsx scripts/bootstrap-remote.ts"
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- lib/dev/bootstrap-remote.test.ts lib/db/readiness.test.ts
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/dev/bootstrap-remote.ts lib/dev/bootstrap-remote.test.ts scripts/bootstrap-remote.ts package.json
git commit -m "feat: add guarded Turso bootstrap"
```

### Task 7: Document and enforce the lifecycle

**Files:**
- Modify: `docs/engineering/local-dev.md:161-208`
- Modify: `README.md:71-90`
- Modify: `lib/dev/load-local-env.ts:12-18`
- Modify: `lib/dev/local-dev-docs.test.ts:18-27`
- Modify: `.env.example`

- [ ] **Step 1: Update the documentation test first**

Replace the Turso assertion in `lib/dev/local-dev-docs.test.ts`:

```ts
it('documents safe Turso bootstrap and separates system from QA seed', () => {
  expect(md).toMatch(/CONFIRM_REMOTE_DB_BOOTSTRAP=1/);
  expect(md).toMatch(/npm run db:bootstrap:remote/);
  expect(md).toMatch(/npm run db:seed:qa/);
  expect(md).toMatch(/npm run db:verify/);
  expect(md).toMatch(/no uses la cuenta QA en producción/i);
  expect(md).toMatch(/file:\.\/local\.db/);
});
```

- [ ] **Step 2: Run the docs test and verify RED**

Run:

```bash
npm test -- lib/dev/local-dev-docs.test.ts
```

Expected: FAIL because the new commands are not documented.

- [ ] **Step 3: Replace the Turso runbook**

Document these exact flows in `docs/engineering/local-dev.md`.

Remote development database:

```bash
CONFIRM_REMOTE_DB_BOOTSTRAP=1 npm run db:bootstrap:remote
npm run db:seed:qa
npm run db:verify
```

Public beta/production database:

```bash
NODE_ENV=production CONFIRM_REMOTE_DB_BOOTSTRAP=1 npm run db:bootstrap:remote
npm run db:verify
```

State explicitly that production bootstrap seeds only system exercises,
routines and tips. Real users register through `/register`; the known QA
account is forbidden in production.

- [ ] **Step 4: Update README and `.env.example`**

Add the scripts:

```text
npm run db:seed         # system data only
npm run db:seed:qa      # system data + known QA account; local/CI only
npm run db:verify       # required-table readiness check
npm run db:bootstrap:remote
```

Add commented controls to `.env.example`:

```dotenv
# One-command remote bootstrap requires explicit confirmation for that command.
# Do not persist this as 1 in hosted production environments.
CONFIRM_REMOTE_DB_BOOTSTRAP=

# QA account is enabled only by npm run db:seed:qa and is forbidden in production.
SEED_QA_USER=
```

- [ ] **Step 5: Register both controls as optional environment keys**

Extend `LOCAL_ENV_OPTIONAL_KEYS` in `lib/dev/load-local-env.ts`:

```ts
export const LOCAL_ENV_OPTIONAL_KEYS = [
  'TURSO_AUTH_TOKEN',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_WEBHOOK_SECRET',
  'GEMINI_API_KEY',
  'NODE_ENV',
  'CONFIRM_REMOTE_DB_BOOTSTRAP',
  'SEED_QA_USER',
] as const;
```

- [ ] **Step 6: Run documentation and setup tests**

Run:

```bash
npm test -- lib/dev/local-dev-docs.test.ts lib/dev/env-example.test.ts lib/dev/setup-local.test.ts lib/db/seed-options.test.ts
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add docs/engineering/local-dev.md README.md .env.example lib/dev/load-local-env.ts lib/dev/local-dev-docs.test.ts
git commit -m "docs: document safe database bootstrap"
```

### Task 8: Bootstrap the current Turso development database

**Files:**
- Modify locally only: `.env`
- Database side effects: configured Turso development database

- [ ] **Step 1: Stop the existing Next.js server**

Stop the exact process that owns port 3000. Restarting is required because
Next.js reads `.env` at process startup.

- [ ] **Step 2: Bootstrap schema and system data**

Run:

```bash
CONFIRM_REMOTE_DB_BOOTSTRAP=1 npm run db:bootstrap:remote
```

Expected:

```text
Running migrations...
Migrations complete!
Database schema is ready.
Remote database bootstrap completed.
```

- [ ] **Step 3: Add the QA account only because this database is development**

Run:

```bash
NODE_ENV=development npm run db:seed:qa
```

Expected: QA user created or updated; system rows remain idempotent.

- [ ] **Step 4: Verify readiness**

Run:

```bash
npm run db:verify
```

Expected:

```text
Database schema is ready.
```

- [ ] **Step 5: Restart the application and verify login API**

Run:

```bash
npm run dev
```

In another terminal:

```bash
curl -i \
  -H 'Content-Type: application/json' \
  -d '{"email":"qa@atlas.test","password":"Test1234!"}' \
  http://localhost:3000/api/auth/login
```

Expected: HTTP 200 and a `Set-Cookie: atlas_session=...` header.

- [ ] **Step 6: Verify the nonexistent-user contract**

Run:

```bash
curl -i \
  -H 'Content-Type: application/json' \
  -d '{"email":"missing-user@atlas.test","password":"Test1234!"}' \
  http://localhost:3000/api/auth/login
```

Expected: HTTP 401 with:

```json
{
  "code": "UNAUTHORIZED",
  "message": "Email o contraseña inválidos"
}
```

### Task 9: Full verification, audit, and integration

**Files:**
- Review all changed files from Tasks 2-7

- [ ] **Step 1: Run the complete local quality gate on isolated databases**

Run:

```bash
rm -f /tmp/atlas-bootstrap-unit.db /tmp/atlas-bootstrap-e2e.db
npm run lint
npm run typecheck
TURSO_DATABASE_URL=file:/tmp/atlas-bootstrap-unit.db npm run db:migrate
TURSO_DATABASE_URL=file:/tmp/atlas-bootstrap-unit.db npm test
TURSO_DATABASE_URL=file:/tmp/atlas-bootstrap-e2e.db npm run db:migrate
TURSO_DATABASE_URL=file:/tmp/atlas-bootstrap-e2e.db NODE_ENV=test npm run db:seed:qa
TURSO_DATABASE_URL=file:/tmp/atlas-bootstrap-e2e.db SESSION_SECRET=test-session-secret-for-bootstrap-plan npm run build
CI=1 \
  TURSO_DATABASE_URL=file:/tmp/atlas-bootstrap-e2e.db \
  SESSION_SECRET=test-session-secret-for-bootstrap-plan \
  CRON_SECRET=test-cron-secret-for-bootstrap-plan \
  npm run test:e2e
```

Expected:

- lint: zero errors;
- typecheck: zero errors;
- Jest: all suites pass;
- build: exit 0;
- Playwright: zero failures and zero flaky tests.

- [ ] **Step 2: Run the security-sensitive regression set**

Run:

```bash
npm test -- \
  lib/db/errors.test.ts \
  lib/auth/middleware.test.ts \
  lib/db/seed-options.test.ts \
  lib/db/readiness.test.ts \
  lib/dev/bootstrap-remote.test.ts \
  lib/dev/setup-local.test.ts
```

Expected: all focused tests PASS.

- [ ] **Step 3: Confirm no secret entered Git**

Run:

```bash
git status --short
git diff --check
git grep -nE '(TURSO_AUTH_TOKEN|TELEGRAM_BOT_TOKEN|GEMINI_API_KEY)=[^[:space:]]+' -- . ':!*.example' ':!docs/**'
```

Expected: `.env` is absent from status/diff and the grep prints no real
credential assignments.

- [ ] **Step 4: Run mandatory code review**

Invoke the `code-review` agent over the complete branch diff and application
context. Resolve every high-confidence finding, then rerun Steps 1-3.

- [ ] **Step 5: Commit any review corrections**

```bash
git add .
git commit -m "fix: apply database bootstrap review findings"
```

Skip this commit only when the reviewer produces no changes.

- [ ] **Step 6: Create the PR**

Create the defect issue, capture its number, then push the branch and open a PR
to `develop`:

```bash
ISSUE_URL=$(gh issue create \
  --title "Login returns 500 when Turso schema is not initialized" \
  --body "A configured but empty Turso database causes login to fail with no such table: users. Add guarded bootstrap, readiness verification, safe seed modes, and a 503 mapping.")
ISSUE_NUMBER=${ISSUE_URL##*/}
printf '%s\n' \
  '## Descripción' \
  'El login devolvía 500 porque una base Turso nueva podía recibir tráfico antes de tener migraciones. Un usuario inexistente en una base saludable ya devuelve 401; la causa real era `no such table: users`.' \
  '' \
  '## Solución' \
  'Se agregó clasificación segura de schema no disponible, verificación de readiness, bootstrap remoto explícito y separación entre seed de sistema y cuenta QA.' \
  '' \
  '## Tests' \
  'Se cubrieron errores libSQL anidados, mapeo 503, seed QA bloqueado en producción, readiness y orden del bootstrap. La suite completa y Playwright se ejecutaron sobre bases aisladas.' \
  '' \
  '## Auditoría pre-PR' \
  'Se ejecutó revisión completa del diff y se resolvieron todos los hallazgos.' \
  '' \
  "Closes #${ISSUE_NUMBER}" \
  > /tmp/atlas-turso-bootstrap-pr.md
git push -u origin fix/turso-bootstrap-login
gh pr create \
  --base develop \
  --head fix/turso-bootstrap-login \
  --title "fix: make Turso bootstrap explicit and safe" \
  --body-file /tmp/atlas-turso-bootstrap-pr.md
```
