# P1.1 Session hardening

Must from [`docs/codebase/CONCERNS.md`](../codebase/CONCERNS.md) P1.1.
Design: [`docs/architecture/ADR-004-sessions.md`](../architecture/ADR-004-sessions.md).

Status: implemented on `feature/p1-1-sessions` (PR draft until CI green).

## Checklist

- [x] Cookie payload `userId` + `sessionId` + `iat` + `exp` (7 days); HMAC over full payload
- [x] Decode / `requireAuth` reject missing, invalid signature, expired `exp`
- [x] Durable table `sessions` (not `sessionVersion` on `users`)
- [x] Login/register issue a new `sessionId` and persist the row (multi-device)
- [x] Logout revokes current `sessionId` then clears cookie
- [x] Edge (`lib/auth/session-edge.ts`) validation parity (HMAC + payload + `exp`)
- [x] Tests: expired → 401; revoked → 401; unique sessionIds; logout reuse → 401
- [ ] Playwright auth specs remain green (CI)

## Session model

Multi-device: each login creates a new row. Logout revokes **only** the current
cookie's `sessionId`. Password change (when added) should revoke all active rows
for that user.

Navigation proxy validates HMAC + `exp` without hitting the DB (Edge-compatible).
APIs call `requireAuth`, which also requires an unrevoked `sessions` row.

## Verify

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
```
