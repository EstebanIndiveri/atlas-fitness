# P0 hardening (beta readiness)

Must items from [`docs/codebase/CONCERNS.md`](../codebase/CONCERNS.md) P0.1–P0.4.

Status: **WIP** — draft PR; implementation in progress.

## Checklist

- [ ] **P0.1** `SESSION_SECRET` fail-closed in production (no public HMAC fallback)
- [ ] **P0.2** Telegram webhook secret required in production / when bot token is set (timing-safe; explicit insecure flag for local/test)
- [ ] **P0.3** Jest never uses `local.db` or shared Turso; isolated temp DB + migrate
- [ ] **P0.4** Workout invariants: one active workout; no set mutations after `endedAt`; invalid `routineId` → 400 VALIDATION

## Verify

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
```
