# P0 hardening (beta readiness)

Must items from [`docs/codebase/CONCERNS.md`](../codebase/CONCERNS.md) P0.1–P0.4.

**Hallazgo histórico / estado en el workstream original:** implementado en `feature/p0-hardening`; PR señalado como draft hasta CI verde.

**Estado actual:** P0.1–P0.4 están implementados en la base `develop` posterior a PR #114. Evidencia: `lib/auth/session.ts`, `lib/telegram/webhook-secret.ts`, `lib/db/database-url.ts`, `lib/db/test-database.ts`, `lib/services/workouts.ts`, `lib/services/workout-sets.ts` y los tests relacionados. PR #114 aporta además verificación E2E, no cambia estos fixes.

## Checklist

- [x] **P0.1** `SESSION_SECRET` fail-closed in production (no public HMAC fallback)
- [x] **P0.2** Telegram webhook secret required in production / when bot token is set (timing-safe; `ALLOW_INSECURE_TELEGRAM_WEBHOOK` for local/test only)
- [x] **P0.3** Jest never uses `local.db` or shared Turso; isolated temp DB + migrate
- [x] **P0.4** Workout invariants: one active workout; no set mutations after `endedAt`; invalid `routineId` → 400 VALIDATION

## Verify — ejecución histórica del workstream P0

```bash
npm run lint
npm run typecheck
npm test                 # 56 suites / 335 tests; DB under /tmp
npm run test:e2e         # Playwright Must (CI retries cover known register race)
```
