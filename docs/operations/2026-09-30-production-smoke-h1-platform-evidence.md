# H1 — Production authenticated smoke harness: platform & security controls evidence

**Status: CONTROLS ESTABLISHED — evidence record.**
**Workstream:** H1 of `docs/superpowers/specs/2026-09-30-production-authenticated-smoke-harness-architecture.md`.
**Date:** 2026-09-30 (America/Argentina/Cordoba).
**Baseline `origin/develop`:** `f805f0a0a46889662a1736537c0fb86b72687154`.
**Package version:** `0.11.0` (unchanged).

This document records the platform prerequisites required by the approved architecture.
It is the only artifact produced by H1. No application/runtime/workflow/runner code,
schema, secret, account, or release status was changed.

> **Superseded control (2026-09-30).** The required-reviewer / self-review-prevention
> requirement recorded in §3 below was replaced by the owner's single-owner
> authorization model: `production-qa` now has **no required reviewers** and
> `prevent_self_review` is not applicable, while the explicit `main`-only branch policy
> and `can_admins_bypass=false` remain. The §3 reviewer values are the **historical H1
> snapshot**. See runbook §3, the architecture owner-policy update, and
> [`2026-09-30-production-smoke-h5-execution-evidence.md`](./2026-09-30-production-smoke-h5-execution-evidence.md).

## 1. Scope actually changed

| Area | Before | After |
|---|---|---|
| `main` branch protection | Unprotected (API 404 "Branch not protected") | Protected (see §2) |
| GitHub Environment `production-qa` | Did not exist | Exists with reviewer + branch controls (see §3) |
| Ops documentation | None for this harness | This file (+ `docs/README.md` index entry) |

No GitHub Environment secret exists in `production-qa`. No repository secret was created.
No QA account was created. No workflow was added. No production smoke was executed.

## 2. `main` branch protection (GitHub platform control)

Repository `EstebanIndiveri/atlas-fitness` is **public**; default branch `main`.
Configured via `PUT /repos/{owner}/{repo}/branches/main/protection`.

| Control | Value | Rationale |
|---|---|---|
| `required_pull_request_reviews.required_approving_review_count` | `0` | All `main` changes must enter through a pull request; matches `AGENTS.md` "Prohibido push directo a `main`". |
| `enforce_admins.enabled` | `true` | Rules apply to administrators too; prevents an admin bypass of the PR gate. |
| `allow_force_pushes.enabled` | `false` | History on `main` cannot be rewritten. |
| `allow_deletions.enabled` | `false` | `main` cannot be deleted. |
| `required_status_checks` | `null` | No new required checks invented (out of scope for the approved architecture). |
| `restrictions` | `null` | No new push-actor restrictions invented. |
| `required_conversation_resolution` | `false` | Not required by the approved architecture. |
| `required_linear_history` | `false` | Not required by the approved architecture. |

Verification readback:

```json
{"pr_reviews":0,"enforce_admins":true,"force_push":false,"deletions":false}
```

These are the **only** governance changes made. No unrelated protection/ruleset was added.

## 3. `production-qa` GitHub Environment (historical H1 snapshot)

Created via `PUT /repos/{owner}/{repo}/environments/production-qa`.

| Control | Value |
|---|---|
| `name` | `production-qa` |
| `can_admins_bypass` | `false` (protection rules are mandatory, including for admins) |
| `prevent_self_review` | `true` |
| required reviewers | `EstebanIndiveri` (id `54692138`), `estebanindiveriraven` (id `158518760`) |
| `deployment_branch_policy.protected_branches` | `false` |
| `deployment_branch_policy.custom_branch_policies` | `true` |
| custom branch policy | exactly one: `main` (type `branch`) |
| secrets in environment | **none** (`ATLAS_PROD_SMOKE_PASSWORD` deliberately NOT created in H1) |

The explicit `main`-only custom branch policy is deliberate: the architecture §5 requires
an explicit `main` restriction rather than relying on "protected branches only".
Because `can_admins_bypass=false` and self-review is prevented, an approved run cannot be
silently self-approved by the dispatcher.

Verification readback:

```json
{"name":"production-qa","can_admins_bypass":false,
 "deployment_branch_policy":{"custom_branch_policies":true,"protected_branches":false},
 "protection_rules":[
   {"type":"required_reviewers","prevent_self_review":true,"reviewers":2},
   {"type":"branch_policy"}]}
```

## 4. Operational owners (assigned)

| Responsibility | Owner | Notes |
|---|---|---|
| Password creation/provisioning | Release/Infra — `EstebanIndiveri` | One-time, at H5 provisioning; never embedded in source. |
| Password rotation | Release/Infra — `EstebanIndiveri` | The repository has no user-facing password-change/reset API; rotation is an out-of-band owner maintenance action. |
| Session invalidation on incident | Release/Infra — `EstebanIndiveri` | Must be able to revoke all sessions for the QA identity out of band; the smoke workflow cannot do this. |
| Environment reviewer | `EstebanIndiveri` + `estebanindiveriraven` | Both authorized; self-review prevented. |
| Recovery runbook / incident response | Assigned in H4 runbook (docs). | H1 records the control existence only. |

## 5. v0.11 Production target verification (read-only)

Verified only through GitHub Deployment metadata available to this environment. No login,
no authenticated request, no fixture.

| Field | Expected | Observed |
|---|---|---|
| GitHub deployment id | `6750037524` | `6750037524` |
| Environment | `Production` | `Production` |
| Release SHA | `27fe2a04e716b814f4c10fbdb29b9a827cdaf39e` | `27fe2a04e716b814f4c10fbdb29b9a827cdaf39e` |
| Deployment status | success | `success` ("Deployment has completed") |
| `environment_url` | `https://atlas-fitness-8tih7vhbe-eindi-acme.vercel.app` | `https://atlas-fitness-8tih7vhbe-eindi-acme.vercel.app` |
| Annotated tag `v0.11.0` peel | `27fe2a04…` | `27fe2a04e716b814f4c10fbdb29b9a827cdaf39e` (tag object `eb2aab85a7739b0caa454726f230784f2ae92424`) |
| Safe reachability probe | HTTP reachable | `HEAD` → `200` at the exact URL (2026-09-30) |

**Target verification result: `VERIFIED` for v0.11** (metadata + safe reachability).
This is historical deployment metadata, not proof of a completed authenticated smoke, and
it does not itself attach Production credentials/DB. A later Production deployment exists
for `b1ee766`; it is **not** used to claim v0.11. The H3 workflow must still prove the
exact SHA/environment/URL at run time and reject a Preview or a different SHA.

## 6. Accepted known residual (operational)

Per architecture §8, the dedicated QA identity's synthetic `longestStreak` is an
**accepted, QA-only operational residual** and is never release evidence. Cleanup means
product-visible fixture cleanup, not physical/derived-state restoration. No DB cleanup,
QA-only endpoint, streak-reset API, admin role, auth bypass, or `is_test_user` may be
introduced to remove it. Future invalidation triggers are documented in the architecture §8
and will be restated in the H4 runbook.

## 7. Explicit non-actions (security boundary preserved)

- No direct production DB access added; no Turso production credential anywhere.
- No arbitrary SQL; no QA-only production runtime endpoint; no auth bypass.
- No session-mint endpoint; no admin role; no `is_test_user` field.
- No mutation of unrelated users; `qa@atlas.test` remains local/CI-only.
- No production smoke executed; no workflow dispatched.
- No `ATLAS_PROD_SMOKE_PASSWORD` or any secret stored in H1.
- No package version change; no product/runtime/schema/auth change; no `main`/tag mutation.

## 8. H1 acceptance

- [x] `main` genuinely protected against direct uncontrolled modification.
- [x] `production-qa` exists with explicit `main`-only restriction.
- [x] Required reviewer configured; self-review prevented.
- [x] Credential rotation/incident owners assigned.
- [x] v0.11 Production target verified or unverifiable state recorded (VERIFIED).
- [x] Accepted `longestStreak` residual documented.
- [x] No secret stored; no QA account created; no product/runtime mutation.

**H1 result: PASS** (platform controls established; human still required to approve this
evidence record through normal review).
