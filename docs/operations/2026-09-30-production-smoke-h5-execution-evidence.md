# H5 — Production authenticated smoke: execution evidence (v0.11.0)

**Status: EXECUTED — PASS.**
**Workstream:** H5 of `docs/superpowers/specs/2026-09-30-production-authenticated-smoke-harness-architecture.md`.
**Depends on:** H1 platform controls, H2 runner (`scripts/production-smoke/`), H3 workflow (`.github/workflows/production-auth-smoke.yml`), H4 runbook + evidence schema.
**Date:** 2026-09-30 (America/Argentina/Cordoba).

This document records the single authorized authenticated production smoke run for
the already-published **v0.11.0** release. It is a post-release operational evidence
record. It changes no production runtime behavior, no credential, no tag, no package
version and no release object; the self-authenticated smoke closes the one item the
v0.11 release left pending.

## 1. Authorization model (owner decision of 2026-09-30)

The owner replaced the earlier two-reviewer environment design. Current model:

- **Changes to trusted `main` require a Pull Request** (`required_approving_review_count: 0`;
  the owner inspects CI/diff and merges). Direct uncontrolled pushes to `main` remain
  forbidden.
- **Production smoke execution is authorized by explicit `workflow_dispatch`.** No GitHub
  Environment reviewer and no second identity approval are required; `prevent_self_review`
  is not applicable.
- The `production-qa` environment keeps an **explicit `main`-only** deployment branch
  policy and `can_admins_bypass: false`.

Reason: Atlas is a single-owner personal project; the security boundary is the mandatory
PR/trusted-`main` gate plus explicit manual dispatch. A second approval identity added
workflow friction without current human separation. Future hardening (only when the project
gains maintainers/operational scale) may reintroduce required PR approvals, CODEOWNERS,
environment required reviewers, and a dispatcher/approver split. This is **not** current
release debt.

## 2. Environment `production-qa` — final observed state

| Control | Value |
|---|---|
| Environment name | `production-qa` |
| `can_admins_bypass` | `false` |
| Required reviewers | **none** (no `required_reviewers` protection rule) |
| `prevent_self_review` | disabled / not applicable |
| `deployment_branch_policy.custom_branch_policies` | `true` |
| Custom branch policy | exactly one: `main` (type `branch`) |
| Environment variable | `ATLAS_PROD_SMOKE_EMAIL` (present, non-secret) |
| Environment secret | `ATLAS_PROD_SMOKE_PASSWORD` (present; value never read, printed or rotated) |

The environment was **not** deleted or recreated, and the secret value was not altered.

## 3. Trusted `main` protection (unchanged)

| Control | Value |
|---|---|
| Require pull request before merging | yes (`required_pull_request_reviews` present) |
| Required approving reviews | `0` |
| `enforce_admins.enabled` | `true` |
| Allow force pushes | `false` |
| Allow deletions | `false` |

## 4. v0.11 target (revalidated before dispatch)

| Field | Value |
|---|---|
| Release SHA (`release_sha`) | `27fe2a04e716b814f4c10fbdb29b9a827cdaf39e` |
| GitHub deployment id | `6750037524` |
| Deployment environment | `Production` |
| Latest deployment status | `success` |
| `environment_url` | `https://atlas-fitness-8tih7vhbe-eindi-acme.vercel.app` |
| Reachability probe | `HEAD` → `200` |
| Annotated tag `v0.11.0` object | `eb2aab85a7739b0caa454726f230784f2ae92424` |
| Annotated tag `v0.11.0` peeled target | `27fe2a04e716b814f4c10fbdb29b9a827cdaf39e` |

The workflow resolved the target from the GitHub Deployments API (no provider token, no
data-store credential); the base URL was derived from deployment metadata, never an
operator input.

## 5. Workflow run

| Field | Value |
|---|---|
| Workflow | `Production Auth Smoke` (`.github/workflows/production-auth-smoke.yml`) |
| Workflow run id | `36747341881` |
| Workflow SHA (trusted `main`) | `1a211fbc7cf9d0611edd2c45ae4a0b89322d6f60` |
| Ref | `main` |
| Event | `workflow_dispatch` |
| Inputs | `release_sha=27fe2a04e716b814f4c10fbdb29b9a827cdaf39e`, `mode=smoke`, `confirmation=run-production-smoke` |
| Created / completed (UTC) | 2026-09-30T16:52:14Z / 2026-09-30T16:52:49Z |
| Conclusion | `success` |

The run proceeded directly with **no** "Waiting for approval" pause, confirming the
environment reviewer requirement is gone. The job's own gate
(`Enforce smoke and cleanup results`) failed the job unless the smoke PASSed **and** the
recovery/cleanup step succeeded; the job concluded `success`.

## 6. Sanitized evidence artifact

- Artifact name: `production-smoke-evidence` (id `11113136751`), retention 14 days.
- Files: `production-smoke-evidence.json`, `production-smoke-recovery.json`.
- Schema: [`production-auth-smoke-evidence-schema.md`](./production-auth-smoke-evidence-schema.md).

Smoke (`production-smoke-evidence.json`):

| Field | Value |
|---|---|
| `overallResult` | `PASS` |
| `expectedReleaseSha` / `actualReleaseSha` | `27fe2a04e716b814f4c10fbdb29b9a827cdaf39e` / same |
| `deploymentId` / `deploymentEnvironment` | `6750037524` / `Production` |
| `deploymentUrl` | `https://atlas-fitness-8tih7vhbe-eindi-acme.vercel.app` |
| `workflowRunId` | `36747341881` |
| `qaRunId` | `f3886c639b1e9eb76a84fe42cad38b16` |
| `targetResult` | `PASS` |
| `authResult` | `PASS` (real password login, exact QA identity, unauthenticated control `401`) |
| `reauthResult` | `PASS` (logout revokes session; old cookie replay `401`; fresh login; persisted note/context survive) |
| `historyResult` | `PASS` (historical workout A exact-exercise raw previous sets; open workout B excluded) |
| `noteResult` | `PASS` (create note, id, `version: 1`, ownership, persisted context) |
| `casResult` | `PASS` (stale mutation `409`, no unexpected mutation) |
| `cleanupResult` | `PASS` (`fixtures_removed`) |
| `recoveredOrphans` | `0` |
| `knownQaIdentityResidualState.longestStreak` | `1` — accepted QA-only residual, **not** release evidence |

Recovery (`production-smoke-recovery.json`):

| Field | Value |
|---|---|
| `overallResult` | `PASS` |
| `targetResult` / `authResult` | `PASS` / `PASS` |
| `cleanupResult` | `PASS` (`nothing_to_recover`) |
| `recoveredOrphans` | `0` |
| `historyResult` / `noteResult` / `casResult` / `reauthResult` | `SKIP` (recovery-only pass never creates a fixture) |

**Result: `AUTHENTICATED_PRODUCTION_SMOKE = PASS`** (target exact, workflow successful,
smoke `PASS`, recovery/cleanup `PASS`, product-visible fixture cleanup confirmed).

## 7. Accepted residual

The dedicated QA identity's synthetic `longestStreak` (`1`) is an **accepted, QA-only
operational residual** per architecture §8 and runbook §15. It is never release evidence
and never a product metric. Cleanup means **product-visible fixture cleanup**, not
physical/derived-state restoration. No DB cleanup, QA-only endpoint, streak-reset API,
admin role, auth bypass or `is_test_user` was introduced to remove it.

## 8. Explicit non-actions

- No `v0.11.0` tag move, recreation or new tag (`v0.11.0` still peels to `27fe2a04…`).
- No package version change (`package.json` / `package-lock.json` remain `0.11.0`).
- No v0.11 release PR repeat and no new product release / GitHub Release object.
- No production redeploy performed to change release truth.
- No production runtime, schema, workflow or runner change.
- The password was never read, displayed, rotated or recreated; the evidence is sanitized
  (no password, cookie, `Set-Cookie`/`Cookie` header, session token or raw request headers).

## 9. References

- Architecture: [`../superpowers/specs/2026-09-30-production-authenticated-smoke-harness-architecture.md`](../superpowers/specs/2026-09-30-production-authenticated-smoke-harness-architecture.md)
- H1 platform evidence: [`2026-09-30-production-smoke-h1-platform-evidence.md`](./2026-09-30-production-smoke-h1-platform-evidence.md)
- Runbook: [`production-auth-smoke-runbook.md`](./production-auth-smoke-runbook.md)
- Evidence schema: [`production-auth-smoke-evidence-schema.md`](./production-auth-smoke-evidence-schema.md)
