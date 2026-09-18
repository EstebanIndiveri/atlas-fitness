# P1.2 Ownership isolation

Must from [`docs/codebase/CONCERNS.md`](../codebase/CONCERNS.md) P1.2.

Status: WIP on `feature/p1-2-ownership` (draft PR until CI green).

## Checklist

- [ ] Shared helper `canAccessCatalogItem({ isSystem, userId }, currentUserId)`
- [ ] 404 NOT_FOUND for foreign catalog items (no existence leak)
- [ ] Exercises GET/POST/PATCH/DELETE + services
- [ ] Routines list/get + services
- [ ] Workout create with `routineId` (system or owned)
- [ ] Workout set create/update with `exerciseId` (system or owned)
- [ ] Lists filter to current user + system
- [ ] Tests: system visible; own custom visible; foreign → 404; lists exclude foreign

## Policy

`isSystem || userId === currentUser`. Reuse day-summary catalog visibility. DTOs must not expose `userId`.
