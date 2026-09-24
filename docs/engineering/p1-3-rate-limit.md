# P1.3 Rate limit auth (login / register)

Must from [`docs/codebase/CONCERNS.md`](../codebase/CONCERNS.md) P1.3.

**Hallazgo histórico / estado en el workstream original:** implementado en `feature/p1-3-rate-limit-auth`.

**Estado actual:** el rate limiting durable está implementado para `POST /api/auth/login` y `POST /api/auth/register`. Este cierre no se extiende a las superficies listadas en P1.3b; no se afirma que Telegram, Gemini o crons tengan rate limiting.

## Scope

- `POST /api/auth/login`
- `POST /api/auth/register`

Out of scope (P1.3b): Telegram codes, webhook, Gemini, crons, Redis, product UI copy.

## Checklist

- [x] Rate limit by IP + action (`login` | `register`)
- [x] Durable Turso/SQLite table (`rate_limit_buckets`) via Drizzle — not process memory
- [x] Over limit → HTTP 429 + `Retry-After` + `{ code, message }` (Spanish, generic)
- [x] Defaults: login 10/min per IP, register 5/min per IP
- [x] Client IP from trusted proxy headers (`x-forwarded-for` first hop / `x-real-ip`)
- [x] Shared helper `lib/auth/rate-limit.ts` + `lib/services/rate-limit.ts`, wired into auth routes
- [x] Tests: under limit OK; over limit 429; IPs isolated; login vs register separate

## Algorithm

**Fixed window** of 60 seconds per key `action:ip`, stored in `rate_limit_buckets`
(`key`, `window_start`, `count`).

Chosen over sliding window because a single SQLite/Turso upsert is atomic
(`ON CONFLICT DO UPDATE`: increment if `window_start` matches, else reset to 1)
and `Retry-After` is the seconds remaining in the current window. Process
memory is not used: Vercel serverless instances do not share RAM.

Defaults (override with env):

| Action | Env | Default |
|---|---|---|
| login | `AUTH_RATE_LIMIT_LOGIN_PER_MINUTE` | 10 |
| register | `AUTH_RATE_LIMIT_REGISTER_PER_MINUTE` | 5 |

Playwright's `webServer` raises both to 100 so E2E can register a fresh user
per spec from one IP without waiting for the window. Production/beta keep the
defaults above.

Over limit body: `{ "code": "RATE_LIMIT", "message": "Demasiados intentos. Probá de nuevo en un momento." }` — no email/user existence leak (limit runs **before** credential checks).

## Client IP (Vercel)

1. `x-forwarded-for` — leftmost hop (Vercel documents this as the original client).
2. Else `x-real-ip`.
3. Else `unknown` (shared bucket; fail closed-ish).

Assumption: Vercel (or another trusted reverse proxy) **overwrites** these
headers. Later hops are ignored so a client cannot append a hop to steal
another bucket. A proxy **in front of** Vercel that concatenates
attacker-controlled `X-Forwarded-For` can poison the leftmost hop; that
topology is out of scope.

## Verify

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
```
