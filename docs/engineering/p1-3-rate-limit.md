# P1.3 Rate limit auth (login / register)

Must from [`docs/codebase/CONCERNS.md`](../codebase/CONCERNS.md) P1.3.

Status: WIP on `feature/p1-3-rate-limit-auth` (draft PR; implementation in progress).

## Scope

- `POST /api/auth/login`
- `POST /api/auth/register`

Out of scope (P1.3b): Telegram codes, webhook, Gemini, crons, Redis, product UI copy.

## Checklist

- [ ] Rate limit by IP + action (`login` | `register`)
- [ ] Durable Turso/SQLite table (`rate_limit_buckets`) via Drizzle — not process memory
- [ ] Over limit → HTTP 429 + `Retry-After` + `{ code, message }` (Spanish, generic)
- [ ] Defaults: login 10/min per IP, register 5/min per IP
- [ ] Client IP from trusted proxy headers (`x-forwarded-for` first hop / `x-real-ip`)
- [ ] Shared helper `lib/auth/rate-limit.ts` + service, wired into auth routes
- [ ] Tests: under limit OK; over limit 429; IPs isolated; login vs register separate

## Algorithm (planned)

Fixed window of 60 seconds per key `ip:action`, stored in `rate_limit_buckets`
(`key`, `window_start`, `count`). Chosen for simple atomic upserts on SQLite/Turso
and a stable `Retry-After` (seconds remaining in the window).

## Verify

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
```
