# P1.2 Ownership isolation

Must from [`docs/codebase/CONCERNS.md`](../codebase/CONCERNS.md) P1.2.

**Hallazgo histórico / estado en el workstream original:** implementado en `feature/p1-2-ownership`; PR señalado como draft hasta CI verde.

**Estado actual:** ownership de ejercicios/rutinas está implementado en `develop`; ver [ADR-005](../architecture/ADR-005-ownership-catalog.md), `lib/auth/ownership.ts` y los services de catálogo/rutinas/workouts.

## Checklist

- [x] Shared helper `canAccessCatalogItem({ isSystem, userId }, currentUserId)`
- [x] 404 NOT_FOUND for foreign catalog items (no existence leak)
- [x] Exercises GET/POST/PATCH/DELETE + services
- [x] Routines list/get + services
- [x] Workout create with `routineId` (system or owned)
- [x] Workout set create/update with `exerciseId` (system or owned)
- [x] Lists filter to current user + system
- [x] Tests: system visible; own custom visible; foreign → 404; lists exclude foreign

## Policy

`isSystem || userId === currentUser` via `lib/auth/ownership.ts`. GET of a foreign custom
returns the same `NOT_FOUND` as a missing row. Workout create with a foreign `routineId`
keeps `VALIDATION` / `Rutina no válida` (same as unknown id). Catalog DTOs omit `userId`.

## Verify

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
```
