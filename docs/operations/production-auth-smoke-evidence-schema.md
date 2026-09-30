# Production authenticated smoke — evidence schema

**Status: EVIDENCE SCHEMA — documentation only.**
**Workstream:** H4 of `docs/superpowers/specs/2026-09-30-production-authenticated-smoke-harness-architecture.md`.
**Source of truth:** `scripts/production-smoke/types.ts` (`SmokeEvidence`) and
`scripts/production-smoke/evidence.ts` (sanitizer). If this document and the code
disagree, the code wins; update this document.
**Date:** 2026-09-30 (America/Argentina/Cordoba).

This document defines the sanitized, machine-readable evidence the runner emits,
its PASS/FAIL/INCOMPLETE semantics, what it must never contain, and how a
completed run's evidence is linked to release truth **later** — without changing
v0.11 release status now.

Operator steps live in
[`production-auth-smoke-runbook.md`](./production-auth-smoke-runbook.md).

## 1. Artifact shape and location

- The runner writes sanitized JSON to `ATLAS_SMOKE_EVIDENCE_PATH` (or stdout when
  unset). `schemaVersion` is always `1`.
- The H3 workflow writes two files and uploads them as one artifact:

| Artifact | Files | Notes |
|---|---|---|
| `production-smoke-evidence` | `production-smoke-evidence.json`, `production-smoke-recovery.json` | `retention-days: 14`, `if-no-files-found: warn` |

- Before writing, `assertEvidenceSanitized` scans the serialized JSON for the
  supplied secrets and for the forbidden literals `set-cookie`, `authorization`,
  and `password`. A detected leak throws and nothing is written.

## 2. Fields (exact, sanitized)

| Field | Type | Meaning |
|---|---|---|
| `schemaVersion` | `1` | Evidence schema version. |
| `qaRunId` | string | Random nonsecret run id (128-bit CSPRNG), collision-safe. |
| `expectedReleaseSha` | string | Release SHA passed as `release_sha`. |
| `actualReleaseSha` | string \| null | Deployment SHA resolved by the trusted workflow; mismatch aborts before login. |
| `deploymentId` | string \| null | GitHub deployment id (recorded, nonsecret). |
| `deploymentEnvironment` | string \| null | Deployment environment name (must be `Production`). |
| `deploymentUrl` | string \| null | Deployment `environment_url`; its host must equal `ATLAS_SMOKE_BASE_URL`. |
| `workflowRunId` | string \| null | CI run id. |
| `startedAt` | string | ISO timestamp (run start). |
| `completedAt` | string | ISO timestamp (run end). |
| `targetResult` | `StepResult` | Target-proof outcome. |
| `authResult` | `StepResult` | Login / `/auth/me` / unauthenticated `401`. |
| `reauthResult` | `StepResult` | Logout revocation + fresh login persistence. |
| `historyResult` | `StepResult` | Workout A history create/set/close and B context raw history. |
| `noteResult` | `StepResult` | Note create with null CAS and context reflection. |
| `casResult` | `StepResult` | Stale CAS `PUT` returns `409` without text change. |
| `cleanupResult` | `StepResult` | Product-visible fixture cleanup and session revocation. |
| `retryAfterSeconds` | number \| null | Present for `429` guidance (INCOMPLETE). |
| `recoveredOrphans` | number | Count of prior QA artifacts recovered during preflight. |
| `knownQaIdentityResidualState` | `{ longestStreak: number \| null }` | Accepted QA-only residual; **non-evidence**, never a product metric. |
| `overallResult` | `PASS` \| `FAIL` \| `INCOMPLETE` | Aggregate outcome. |

`StepResult` is `{ status: 'PASS' | 'FAIL' | 'SKIP' | 'INCOMPLETE'; detail?: string }`.
`detail` is a **non-secret code** only (for example `configuration_incomplete`);
it never contains a value or free-form payload.

## 3. PASS / FAIL / INCOMPLETE semantics

- **`PASS` (exit `0`)** — target verified against the exact Production deployment,
  real login/session, history/context/note/CAS assertions held, product-visible
  fixture cleanup succeeded, and the session was revoked. `overallResult: PASS`.
- **`FAIL` (exit `1`)** — a definitive failure of a target, auth, assertion, or
  cleanup step. Not a partial pass; the release gate stays pending.
- **`INCOMPLETE` (exit `2`)** — no verdict could be reached: missing/invalid
  configuration (no network calls; all step results `SKIP`) or HTTP `429` with
  `retryAfterSeconds`. Retry only after `mode: recovery` confirms no orphan.

A `PASS` requires clean auth, the exact-production target, the assertions, and
product-visible fixture cleanup. `SKIP` appears on phases not exercised (for
example configuration-incomplete runs); it is never a `PASS`.

## 4. Prohibited content

The evidence must **never** contain:

- the password or any secret value;
- cookies, `Set-Cookie`/`Cookie` headers, or session tokens;
- raw HTTP request/response headers or bodies;
- the full synthetic note text;
- any real-user data.

The runner's only filesystem writes are the sanitized evidence file and the
secret-free manifest (nonsecret ids/markers/timestamps/run id only). Both are
validated/redaction-checked before writing. Never enable shell tracing, HTTP
verbose mode, screenshots, or raw response artifacts around a production run.

## 5. Linking evidence to release truth (later only)

This section documents the procedure. **It does not change v0.11 release status
now.** Today, the v0.11 authenticated production smoke is `NOT PERFORMED` and the
release truth in `CHANGELOG.md` / `docs/backlog/handoff-2026-09.md` must not be
edited by this workstream.

After an actual, reviewed run (H5), the release owner may:

1. Confirm the workflow run concluded **success** and the final gate passed
   (`Enforce smoke and cleanup results`), meaning the smoke PASSed and the
   recovery/cleanup succeeded.
2. Download the `production-smoke-evidence` artifact and confirm the JSON shows
   `overallResult: PASS`, the correct `expectedReleaseSha` / `actualReleaseSha` /
   `deploymentId` / `production` environment / deployment URL, and
   `cleanupResult` success.
3. Record a link to the workflow run and the sanitized artifact in the release
   handoff / CHANGELOG as **evidence for that exact release SHA**, in a
   **docs-only** truth update from pending to completed — without moving or
   recreating the `v0.11.0` tag, bumping the package, or repeating the release
   merge.
4. If the run did not PASS, or cleanup failed, or the target drifted, leave the
   release truth pending and record the `NOT VERIFIED` / failure disposition
   instead of a `PASS` claim.

Do **not** claim a `PASS` from a workflow run that did not succeed, from a moving
alias, or from a later SHA tested as v0.11. The QA account's `longestStreak`
residual is never release evidence.

## 6. References

- Runner types: `scripts/production-smoke/types.ts`
- Runner sanitizer: `scripts/production-smoke/evidence.ts`
- Runner contract: [`scripts/production-smoke/README.md`](../../scripts/production-smoke/README.md)
- Operator runbook: [`production-auth-smoke-runbook.md`](./production-auth-smoke-runbook.md)
- Architecture §7: `docs/superpowers/specs/2026-09-30-production-authenticated-smoke-harness-architecture.md`
