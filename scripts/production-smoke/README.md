# Production authenticated smoke / recovery runner

API-only HTTP client that proves a deployed Atlas instance can authenticate a
dedicated QA identity, exercise the exercise-session note/history contracts, and
clean up its own synthetic fixtures **through the public APIs only**.

- It never imports `app/**` or `lib/**` runtime modules and never touches the
  database at runtime. Tests may import route handlers to build an in-process app.
- It never registers a user, never uses SQL, and never calls an admin/QA endpoint.
- Cleanup is product-visible fixture cleanup, not physical/derived-state restoration.
  The QA identity's `longestStreak` is an accepted residual (architecture §8).

## Configuration (environment variables)

| Variable | Required | Purpose |
|---|---|---|
| `ATLAS_SMOKE_BASE_URL` | yes | Exact deployment origin. All requests are bound to this host. |
| `ATLAS_SMOKE_EMAIL` | yes | Dedicated QA identity email (nonsecret operational id). |
| `ATLAS_SMOKE_PASSWORD` | yes | QA identity password. Provided only by the protected environment. |
| `ATLAS_SMOKE_EXPECTED_RELEASE_SHA` | yes | Release SHA under test. |
| `ATLAS_SMOKE_ACTUAL_RELEASE_SHA` | yes | Deployment SHA resolved by the trusted workflow. Mismatch aborts before login. |
| `ATLAS_SMOKE_DEPLOYMENT_ID` | no | GitHub deployment id (recorded in evidence). |
| `ATLAS_SMOKE_DEPLOYMENT_ENVIRONMENT` | no | Deployment environment name. |
| `ATLAS_SMOKE_DEPLOYMENT_URL` | no | Deployment URL; its host must equal `ATLAS_SMOKE_BASE_URL`. |
| `ATLAS_SMOKE_WORKFLOW_RUN_ID` | no | CI run id. |
| `ATLAS_SMOKE_QA_RUN_ID` | no | Test-only override of the generated `qaRunId`. |
| `ATLAS_SMOKE_EVIDENCE_PATH` | no | Evidence output path. When unset, evidence goes to stdout. |
| `ATLAS_SMOKE_MANIFEST_PATH` | no | Secret-free manifest path. Defaults to `<evidencePath>.manifest.json`; unset with no evidence path. |
| `ATLAS_SMOKE_RECOVERY_ONLY` | no | `1`/`true`: perform cleanup only, never create a fixture. |
| `ATLAS_SMOKE_CRASH_WINDOW_MS` | no | Create-before-mark crash window (default 5 min). |

Missing credentials/target => immediate `INCOMPLETE` with no network calls.
HTTP `429` => `INCOMPLETE` with `retryAfterSeconds` guidance. Exit codes:
`PASS=0`, `FAIL=1`, `INCOMPLETE=2`.

## Security contract

- The password, `Set-Cookie`/`Cookie` headers, session tokens, and raw HTTP
  responses are never logged, persisted, or uploaded.
- The cookie jar is in-memory only. The runner's only filesystem writes are the
  sanitized evidence file and the secret-free manifest (non-secret ids/markers/
  timestamps/run id); both are validated/redaction-checked before writing.
- Every request is bound to exactly one expected host; redirects to any other
  host are rejected (`redirect: 'manual'` + `Location` host inspection).
- Every HTTP status decision routes through one helper: `429` is always
  `INCOMPLETE` with `retryAfterSeconds`; unexpected statuses are `FAIL`.
- The exact QA identity is verified via `/api/auth/me`; any unexpected
  `userId` on a mutated resource stops the run.
- Ambiguous artifacts (unknown markers, unmarked/foreign workouts, routine
  mismatch, multiple unexpected workouts) stop cleanup instead of guessing. A
  `404` delete is accepted only after a readback confirms absence; a note delete
  is accepted only after a readback confirms `currentNote:null`.
- A pre-existing manifest is reconciled before a run and removed after clean
  cleanup; a manifest owned by another QA user stops the run.
- `qaRunId` is 128 bits of CSPRNG and collision-safe across concurrent runs.

## Lifecycle (architecture §4)

Login → `/auth/me` email match → unauthenticated `401` → orphan
preflight/recovery → select a system routine/exercise → workout A (marker
`history`) + two sets (`42.5`/`40`) + close → workout B (marker `current`) + one
set (`99`) → context shows A's raw decimals and excludes B → note create with
null CAS → context reflects note → stale CAS `409` → logout + replay `401` →
relogin persistence → note delete → soft-delete B then A → list/active/404
verification → streak reset (`longestStreak` residual recorded) → logout +
replay `401`.

## Evidence (sanitized JSON)

`schemaVersion`, `qaRunId`, `expectedReleaseSha`, `actualReleaseSha`,
`deploymentId`, `deploymentEnvironment`, `deploymentUrl`, `workflowRunId`,
`startedAt`, `completedAt`, `targetResult`, `authResult`, `reauthResult`,
`historyResult`, `noteResult`, `casResult`, `cleanupResult`,
`retryAfterSeconds`, `recoveredOrphans`, `knownQaIdentityResidualState`
(`{ longestStreak }`), `overallResult` (`PASS`/`FAIL`/`INCOMPLETE`).

No password, cookie, session token, raw header, or full synthetic note text is
ever included.

## Run

```sh
npx tsx scripts/production-smoke/index.ts
```

## Tests

```sh
npx jest scripts/production-smoke --runInBand
```

Tests use the isolated migrated test DB from `jest.setup.ts` and an in-process
app that adapts `fetch` to the real Next route handlers. They never contact a
network host.
