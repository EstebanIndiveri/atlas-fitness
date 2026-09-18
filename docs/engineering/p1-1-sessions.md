# P1.1 Session hardening (WIP)

Must from [`docs/codebase/CONCERNS.md`](../codebase/CONCERNS.md) P1.1.
Design: [`docs/architecture/ADR-004-sessions.md`](../architecture/ADR-004-sessions.md).

Status: scaffold on `feature/p1-1-sessions` (PR draft until Must + CI green).

## Checklist

- [ ] Cookie payload `userId` + `sessionId` + `iat` + `exp` (7 days); HMAC over full payload
- [ ] Decode / `requireAuth` reject missing, invalid signature, expired `exp`
- [ ] Durable table `sessions` (not `sessionVersion` on `users`)
- [ ] Login/register issue a new `sessionId` and persist the row (multi-device)
- [ ] Logout revokes current `sessionId` then clears cookie
- [ ] Edge (`lib/auth/session-edge.ts`) validation parity (HMAC + payload + `exp`)
- [ ] Tests: expired → 401; revoked → 401; unique sessionIds; logout reuse → 401
- [ ] Playwright auth specs remain green

## Session model

Multi-device: each login creates a new row. Logout revokes **only** the current
cookie's `sessionId`. Password change (when added) should revoke all active rows
for that user.
