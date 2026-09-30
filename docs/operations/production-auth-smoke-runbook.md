# Production authenticated smoke — operator runbook

**Status: OPERATOR RUNBOOK — documentation only.**
**Workstream:** H4 of `docs/superpowers/specs/2026-09-30-production-authenticated-smoke-harness-architecture.md`.
**Depends on:** H1 platform controls ([`2026-09-30-production-smoke-h1-platform-evidence.md`](./2026-09-30-production-smoke-h1-platform-evidence.md)), the H2 runner (`scripts/production-smoke/`), and the H3 workflow (`.github/workflows/production-auth-smoke.yml`).
**Date:** 2026-09-30 (America/Argentina/Cordoba).

This runbook tells the release operator how to run the authorized production
authenticated smoke (workstream H5) **without inventing steps**. It changes no
release status: the v0.11 authenticated production smoke remains **NOT PERFORMED**
until an actual, reviewed run produces sanitized evidence. Editing this document
does not execute the smoke, create the QA account, or store any secret.

Machine-readable field definitions live in
[`production-auth-smoke-evidence-schema.md`](./production-auth-smoke-evidence-schema.md).
The runner's own configuration/exit-code contract is in
[`scripts/production-smoke/README.md`](../../scripts/production-smoke/README.md).

## 1. Purpose and non-goals

The harness proves, against an exact deployed Production target, that Atlas can:

- authenticate a dedicated ordinary QA identity with a real password login;
- issue a signed session cookie backed by an active database session;
- read and write the exercise-session note/history/context contracts;
- revoke the session on logout and prove a fresh login persists data; and
- clean up its own synthetic fixtures through the public APIs (product-visible
  cleanup), leaving no active or visible smoke artifact.

Non-goals: it does not register users, does not prove registration, does not use
SQL, a QA-only endpoint, admin role, auth bypass, session-mint endpoint, or any
direct production DB credential, and it never touches real-user data. It is not a
runtime deployment dependency.

## 2. Prerequisites

Before any dispatch, confirm all of the following:

1. **The harness exists on the repository DEFAULT branch (`main`).** The H2
   runner (`scripts/production-smoke/**`) and the H3 workflow
   (`.github/workflows/production-auth-smoke.yml`) must be merged to `main`
   **before** H5 dispatch. GitHub only permits `workflow_dispatch` for a workflow
   that is present on the default branch, so a workflow that exists only on
   `develop` cannot be dispatched. See §2.1 for the required promotion path.
2. **H1 controls exist.** `main` is protected; the `production-qa` GitHub
   Environment exists with the controls in §3. Evidence:
   [`2026-09-30-production-smoke-h1-platform-evidence.md`](./2026-09-30-production-smoke-h1-platform-evidence.md).
3. **`production-qa` Environment exists** with required reviewers and self-review
   prevention (§3).
4. **`main` is trusted and protected** (§4).
5. **The workflow is manual only.** `.github/workflows/production-auth-smoke.yml`
   triggers solely on `workflow_dispatch`; there is no `push`, `pull_request`,
   `schedule`, or `workflow_run` trigger. Never add one.
6. **The runner and its tests are green** (`npx jest scripts/production-smoke --runInBand`)
   on the exact ref you intend to dispatch from.
7. **A QA review** of the run plan and **PO** confirmation of release scope, per
   `AGENTS.md` §2 / §5.

If any prerequisite fails, **stop**: do not store a password or dispatch. The
architecture §5 requires these platform controls before a password is placed or a
production run is enabled.

### 2.1 Promote the harness to `main` (required before H5 dispatch)

`workflow_dispatch` is only offered for workflows that exist on the repository
**default branch**. Today the harness lives on `develop` in its entirety:

| Ref | Commit | Contains harness? |
|---|---|---|
| `origin/main` (default) | `b1ee766b…` | **No** |
| `origin/develop` | `fbe4383` | Yes (H2 runner + H3 workflow) |

Dispatching from `develop` is **not** a workaround:

- the job is guarded to `github.ref == 'refs/heads/main'` (workflow `if:`), so a
  `develop` dispatch skips the only job; and
- the `production-qa` Environment branch policy allows only `main`, so a
  `develop` deployment cannot be approved even if the guard were absent.

Required promotion path (per `AGENTS.md` §3 / §5): `develop` → `release/x.y.z` →
`main`, through pull requests with CI and review. Concretely:

1. Ensure the H2 runner and H3 workflow are integrated on `develop`.
2. Open the release-candidate / release PR that carries them to `main` and take it
   through the normal review and CI gates.
3. Confirm the workflow and runner are present on `main` (for example, the Actions
   tab shows **Production Auth Smoke** with a **Run workflow** button only after
   the merge).
4. Only then proceed to the one-time provisioning (§5) and the first H5 dispatch
   (§8).

Do **not** move or recreate the `v0.11.0` tag, do **not** bump the package, and do
**not** repeat the v0.11 release merge. Promotion is a forward merge of the harness
itself, nothing more.

## 3. Environment `production-qa` (platform controls)

Created by H1 via `PUT /repos/{owner}/{repo}/environments/production-qa`; do not
weaken it.

| Control | Value |
|---|---|
| Environment name | `production-qa` |
| `can_admins_bypass` | `false` (protection rules are mandatory, including for admins) |
| `prevent_self_review` | `true` |
| Required reviewers | `EstebanIndiveri` (id `54692138`), `estebanindiveriraven` (id `158518760`) |
| `deployment_branch_policy.protected_branches` | `false` |
| `deployment_branch_policy.custom_branch_policies` | `true` |
| Custom branch policy | exactly one: `main` (type `branch`) |
| Environment secrets — **required target state** | `ATLAS_PROD_SMOKE_PASSWORD` only (§6). H1 recorded **no** environment secret; the operator must provision it at H5. |
| Environment variables — **required target state** | `ATLAS_PROD_SMOKE_EMAIL` only (§6). H1 recorded **none**; the operator must provision it at H5. |

> **Required target state, not current state.** H1 created the Environment with
> **no** secrets or variables ([H1 §3](./2026-09-30-production-smoke-h1-platform-evidence.md)).
> This workstream (H4) does not create them. §6 lists what the operator must
> provision at H5; until then the secret row above is a requirement, not an
> observation.

The explicit `main`-only custom branch policy is deliberate (architecture §5):
do not rely on "protected branches only" while the branch policy configuration is
what enforces the restriction. Because `can_admins_bypass=false` and
`prevent_self_review=true`, an approved run cannot be silently self-approved by
the dispatcher: a **different** authorized reviewer must approve it.

## 4. Trusted `main`

- The job is skipped unless `github.ref == 'refs/heads/main'`.
- The workflow checks out the exact trusted `github.sha`
  (`actions/checkout@v4` with `ref: ${{ github.sha }}`, `persist-credentials: false`).
- `main` must stay protected: all changes enter through a pull request
  (`required_approving_review_count: 0`), `enforce_admins: true`, force pushes and
  deletions disabled. Evidence: H1 §2.

Why it matters: a dispatch from untrusted code could exfiltrate the environment
password. `workflow_dispatch` only runs from `main`, and the checkout pins the
exact protected SHA. The `if` guard and checkout are defense in depth; the GitHub
platform protection of `main` and `production-qa` is the required control, not the
workflow YAML alone.

The workflow requests only `permissions: contents: read`. This was empirically
confirmed sufficient to read the GitHub Deployments API for this public repository
(a temporary check returned HTTP `200` with a `contents: read` token), so no extra
permission is required.

## 5. One-time QA identity provisioning (operator, at H5 — not in H4)

Provision **exactly one** ordinary production user for the smoke. Steps:

1. Create **one** ordinary production user (via the product's ordinary
   registration/owner maintenance path), controlled by the release operator.
   Registration requires a `name` (`users.name` is `notNull`): enter a
   **synthetic, non-personal name** (for example `Atlas QA Smoke`), never a real
   person's name, consistent with "no personal data".
2. Its email is a controlled operational identifier and **must be DISTINCT from
   `qa@atlas.test`**. `qa@atlas.test` is local/CI-only and forbidden in production
   (`docs/engineering/local-dev.md`).
3. Grant **ordinary user permissions only**: no admin role, no QA-only role, no
   auth bypass, no `is_test_user` field.
4. **No Telegram link.** The identity must never be linked to Telegram.
5. **No personal data.** Do not enter real human profile/health data.
6. **No Coach/AI interaction.** Do not use Gemini/Coach flows with this identity.
7. Store the credential in the `production-qa` environment secret (§6). Never
   embed a password in source.
8. Record the chosen email in the non-secret `ATLAS_PROD_SMOKE_EMAIL` variable.

The recurring smoke **never** registers users. If the identity is absent or login
fails, the workflow stops without creating another user. Ambiguous or multiple
identities are a stop condition.

> This workstream (H4) does **not** create the account, does **not** set the
> secret, and does **not** run the smoke. Those are H5 actions by the release
> owner after H1–H4 approval.

## 6. Secret and variable storage

| Item | Kind | Location | Notes |
|---|---|---|---|
| `ATLAS_PROD_SMOKE_PASSWORD` | secret | GitHub **Environment** secret in `production-qa` | The only secret. Never a repository secret, never in Vercel, never a Turso/DB credential. |
| `ATLAS_PROD_SMOKE_EMAIL` | non-secret variable | GitHub **Environment** variable in `production-qa` | Ordinary QA identity email. Nonsecret operational id. |

The workflow reads them as `secrets.ATLAS_PROD_SMOKE_PASSWORD` and
`vars.ATLAS_PROD_SMOKE_EMAIL` only inside the `production-qa` environment job. The
runner never logs the password, `Set-Cookie`/`Cookie` headers, session tokens, or
raw HTTP responses. `SESSION_SECRET`, Turso credentials, and generated per-run
passwords are **not** workflow secrets and are never provided.

## 7. Rotation, session invalidation, and incident owner

Owner (as recorded in H1 §4): **Release/Infra — `EstebanIndiveri`**.

- **Password rotation owner:** `EstebanIndiveri`.
- **All-session invalidation / incident owner:** `EstebanIndiveri`.

The repository contains **no user-facing password-change/reset API**, and the
smoke workflow **cannot revoke sessions**. Rotation and emergency invalidation are
therefore **out-of-band, owner-run** actions using the owner's own privileged
production database access (Turso console/CLI). They are **never** performed by the
smoke workflow.

Mechanism (owner, out of band):

- **Rotate the credential:** set a new bcrypt `users.password_hash` value for the
  QA identity in `lib/db/schema.ts` (`users.name`, `users.email`,
  `users.password_hash`); or deprovision and re-provision the identity through the
  product's ordinary flow and re-set the hash. Use the bcrypt parameters the
  application expects.
- **Invalidate all sessions:** call `revokeAllUserSessions(userId)` from
  `lib/auth/session-store.ts` (owner-run privileged script/console), or directly
  set `sessions.revoked_at` for every non-revoked row of that `userId`. This kills
  **all** sessions for the QA user.

Sequence:

1. **Disable the workflow** (§13, step 1) so no dispatch can run mid-rotation.
2. **Rotate the credential** out of band (new `users.password_hash` for the QA
   identity, or deprovision + re-provision).
3. **Invalidate all QA sessions** out of band (`revokeAllUserSessions(userId)` or
   `sessions.revoked_at`).
4. **Update the `production-qa` environment secret** `ATLAS_PROD_SMOKE_PASSWORD`
   to the new value — rotate the stored value in place and **never commit it**.
5. **Verify:** a fresh login with the new credential succeeds, and the old
   sessions are dead (a replayed pre-rotation cookie is rejected with `401`).
6. **Re-enable** the workflow; optionally run `mode: recovery` (§11) to confirm no
   orphan remains.
7. Retain rotation evidence (see §14).

The smoke workflow itself **never** performs credential or session maintenance: it
only logs in with the identity and revokes its own run session on logout.

## 8. How to dispatch

1. Open **Actions → Production Auth Smoke → Run workflow**.
2. Choose the branch **`main`**. Dispatching from any other ref skips the job
   (`github.ref == 'refs/heads/main'`).
3. Provide the inputs:

| Input | Required | Value |
|---|---|---|
| `release_sha` | yes | Full **40-char lowercase hex** SHA that has **exactly one** successful `Production` deployment. |
| `mode` | yes | `smoke` (default) or `recovery`. |
| `confirmation` | yes | Type exactly `run-production-smoke`. The workflow rejects any other value. |

4. Submit. A required reviewer other than the dispatcher must approve the
   `production-qa` environment deployment.

**Target derivation (no URL input).** Before login, the workflow resolves the
target from the GitHub Deployments API: it requires exactly one `Production`
deployment for `release_sha` whose latest status is `success`, and it uses that
status's `environment_url` as `ATLAS_SMOKE_BASE_URL`. The URL is derived from
deployment metadata and is **never** an operator input. The runner then binds every
request to that single host and rejects redirects to another host. A 200 response
or hostname text alone is not Production proof.

### Expected release SHA / deployment metadata

Current target example (v0.11), as recorded in H1 §5:

| Field | Value |
|---|---|
| Release SHA (`release_sha`) | `27fe2a04e716b814f4c10fbdb29b9a827cdaf39e` |
| GitHub deployment id | `6750037524` |
| Deployment environment | `Production` |
| Deployment URL (`environment_url`) | `https://atlas-fitness-8tih7vhbe-eindi-acme.vercel.app` |

**Selecting future targets.** For any later release, choose the release SHA that
has exactly one successful `Production` deployment in its metadata, then verify
that the deployment SHA matches the requested SHA, the environment is
`Production`, the latest status is `success`, and the `environment_url` is the
exact https deployment origin. If metadata is absent or ambiguous (zero or
multiple Production deployments, non-success status, missing/incorrect URL), the
workflow aborts **before** login. For v0.11 specifically: if the old deployment is
no longer reachable or not correctly bound to production, report `NOT VERIFIED`
and seek release-owner disposition rather than testing a later SHA as v0.11.

## 9. Success criteria (PASS)

A run is `PASS` only if all of the following succeeded (runner exit code `0`,
`overallResult: PASS`):

- **Target:** exactly one `Production` deployment for the exact `release_sha`,
  latest status `success`, URL derived from metadata, host bound and redirects
  rejected.
- **Auth:** real password login succeeds; `/api/auth/me` matches the exact QA
  email and returns the expected user id; an unauthenticated protected request
  returns `401`.
- **Re-auth:** logout revokes the current session (captured cookie rejected with
  `401`), a fresh login issues a new session, and `/auth/me` identity matches.
- **History/context/note/CAS:** workout A history is created, marked, set, and
  closed; workout B context reflects the raw history decimals and excludes the
  open-workout set; note create with a null CAS pair returns `version: 1`; context
  reflects it; a stale CAS `PUT` returns `409` without changing text.
- **Product-visible cleanup:** the note is deleted while B is active; B then A are
  soft-deleted; list omits both ids; active is `null`; direct workout/context
  reads return `404`; the session is logged out/revoked.
- **Evidence:** a sanitized JSON artifact is emitted and uploaded (§ evidence
  schema doc).

Exit codes: `PASS = 0`, `FAIL = 1`, `INCOMPLETE = 2`.

## 10. Failure criteria (FAIL / INCOMPLETE)

| Result | Exit | Meaning | Operator action |
|---|---|---|---|
| `FAIL` | 1 | A target/auth/assertion/cleanup step definitively failed (unexpected HTTP status, wrong user, marker/ownership mismatch, clean-up failed). | Treat as a failed release gate. Run `mode: recovery` (§11). Do not claim `PASS`. |
| `INCOMPLETE` | 2 | The run could not reach a verdict: missing/invalid configuration (no network calls; `targetResult: INCOMPLETE`, remaining phases `SKIP`), or HTTP `429` (login rate limit; `retryAfterSeconds` may be set). A `429` can occur **after** fixture creation, so INCOMPLETE does **not** guarantee that no fixture was created. | Fix configuration, or wait out `retryAfterSeconds`, then re-dispatch after `mode: recovery` confirms no orphan. A mid-run `429` is still covered by the `always()` cleanup pass (§11). |

A `FAIL` or `INCOMPLETE` is **never** partial success. Cleanup failure is never a
success. The workflow's final gate (`Enforce smoke and cleanup results`) fails the
job unless the smoke step PASSed (for `mode: smoke`) **and** the recovery/cleanup
step succeeded.

## 11. Cleanup behavior

- The runner cleans in a **finally-equivalent** path: product-visible fixture
  cleanup executes before evidence is finalized.
- After the smoke step, the workflow always runs an `always()` **recovery-only**
  pass (`ATLAS_SMOKE_RECOVERY_ONLY=1`, evidence `production-smoke-recovery.json`).
  This is the cleanup safety net even if the smoke step failed.
- **Recovery-only manual dispatch (`mode: recovery`)** for the cancellation case:
  if a run is cancelled before the `always()` pass executes, dispatch the same
  workflow with `mode: recovery`, the affected `release_sha`, and the confirmation
  phrase. Recovery performs the same API-only cleanup, never creates a fixture,
  and still needs **no data-store credential**.
- The final gate fails the job unless recovery succeeded. **Cleanup failure is
  never reported as success.**

## 12. Orphan recovery

Each run marks a workout `note` with `ATLAS_SMOKE:<qaRunId>:history` or
`:current` and writes a **secret-free** manifest (expected QA user id,
routine/exercise ids, A/B ids, timestamp, workflow run id — never a password,
cookie, or note text).

Preflight reconciliation (and the recovery pass) classify prior artifacts:

- **Marked** artifacts (any valid `ATLAS_SMOKE:<qaRunId>:<role>`) are recoverable:
  for an active B, read its context CAS pair and delete the note, then soft-delete;
  for A, soft-delete even if complete.
- **Secret-free manifest reconciliation:** an owned workout recorded in the
  manifest is recoverable only if its routine matches the expected system routine.
- **Stale manifest:** a manifest left from a prior run is reconciled before a new
  run and removed after clean cleanup; a manifest owned by another QA user stops
  the run.
- **Create-before-mark crash window:** an owned, unmarked, active workout with no
  sets, created within the crash window (default 5 minutes), matching the expected
  routine, is treated as the just-created orphan and soft-deleted. Because only one
  active workout can exist per user, this window is detectable via `GET active`.
- **Already soft-deleted:** a `404` delete is accepted only after a readback
  confirms absence from the list; a note delete is accepted only after a readback
  confirms `currentNote: null`.
- **Ambiguity => STOP / FAIL.** Unknown markers, unmarked/foreign workouts,
  routine mismatch, unexpected user id, or multiple unexpected artifacts stop
  cleanup and alert the owner. **Never delete by guessed id.**

Operational monitoring must flag stale manifests/active QA workouts so a release
owner runs recovery; there must be no silent indefinite orphan. A cancellation may
bypass `always()` and leave a session active up to its maximum lifetime (seven
days); next dispatch begins with preflight reconciliation.

## 13. How to disable the harness

1. **Disable the workflow** (Actions → Production Auth Smoke → Disable, or remove
   the `workflow_dispatch` trigger in a reviewed PR).
2. **Remove/revoke the environment secret** `ATLAS_PROD_SMOKE_PASSWORD` from
   `production-qa`.
3. **Invalidate the QA credential and all sessions** via the out-of-band rotation
   / session-invalidation procedure (§7) — not through the smoke workflow.
4. **Clean visible QA artifacts:** soft-delete any visible QA-owned workouts via
   `mode: recovery`, and delete the active note when possible.
5. **Verify list/active:** `GET /api/workouts` contains no QA smoke ids and
   `GET /api/workouts/active` is `null`.
6. **Retain incident evidence** (see §14).

## 14. Incident response (leaked password or session)

1. **Disable the job** (§13 steps 1–2).
2. **Rotate the credential and invalidate all sessions** via the out-of-band
   procedure (§7). Assume the leaked secret is burned.
3. **Review access logs** (login anomalies, `429`, GitHub audit log) for
   unexplained QA-identity access.
4. **Retain evidence** (workflow run links, sanitized artifacts, timeline) for the
   security owner.
5. **Contain to QA-only data:** no real-user data is involved by design; confirm no
   unexpected workout/artifact and quarantine ambiguity rather than deleting by
   guess.

Emergency invalidation of all account sessions belongs to the out-of-band
procedure in §7, not to the smoke workflow.

## 15. `longestStreak` residual (accepted)

Per architecture §8, the dedicated QA identity's synthetic `longestStreak` is an
**accepted, QA-only operational residual**. After workout soft deletion,
`GET /api/stats/streak` recomputes `currentStreak` and `lastActiveDate` from
visible activity, while `longestStreak` may remain at a synthetic maximum. That
value:

- is **never** release evidence and **never** a product metric;
- is not real-user data and cannot be reached by real users through current
  product reads.

Cleanup means **product-visible fixture cleanup**, not physical/derived-state
restoration. Do not add DB cleanup, a QA-only endpoint, a streak-reset API, an
admin role, an auth bypass, an `is_test_user` field, or a production SQL
credential to remove it. The evidence schema records the residual as a named,
non-evidence field (`knownQaIdentityResidualState.longestStreak`).

## 16. Future invalidation conditions

Revisit this acceptance before introducing any of the following: global analytics
across users; aggregate user metrics; leaderboards; social ranking; cross-user
streak reporting; external analytics ingestion of the QA identity; Coach/AI
processing that compares users; or any production metric where this identity could
contaminate real-user results. At that point an explicit reviewed exclusion
contract or redesign is required. Do not build exclusion infrastructure
preemptively.

## 17. Related documents

- Architecture: [`docs/superpowers/specs/2026-09-30-production-authenticated-smoke-harness-architecture.md`](../superpowers/specs/2026-09-30-production-authenticated-smoke-harness-architecture.md)
- H1 platform evidence: [`2026-09-30-production-smoke-h1-platform-evidence.md`](./2026-09-30-production-smoke-h1-platform-evidence.md)
- Evidence schema: [`production-auth-smoke-evidence-schema.md`](./production-auth-smoke-evidence-schema.md)
- Runner contract: [`scripts/production-smoke/README.md`](../../scripts/production-smoke/README.md)
- Workflow: [`.github/workflows/production-auth-smoke.yml`](../../.github/workflows/production-auth-smoke.yml)
