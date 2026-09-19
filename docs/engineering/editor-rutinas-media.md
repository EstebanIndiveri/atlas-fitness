# Editor rutinas + media (BE API/schema)

Branch: `feature/editor-rutinas-media` · base `develop`  
Status: **WIP** — draft PR opened early; API/schema in progress.

FE coordinates on `feature/editor-rutinas-media-ui`. This branch is **BE only** (no UI, no file upload/S3).

## Checklist

- [ ] `POST /api/routines` — create custom (`isSystem=false`, `userId=current`)
- [ ] `PATCH /api/routines/[id]` — update own custom only (404 foreign / 403 system)
- [ ] `DELETE /api/routines/[id]` — soft-delete own custom only
- [ ] Replace/upsert ordered `routine_exercises` (transactional; unique `sort_order`)
- [ ] Validate every `exerciseId` via `requireAccessibleExercise`; reject empty list
- [ ] Spanish `AppError` messages
- [ ] Custom exercise `imageUrl` / `videoUrl` on create/update (extend existing PATCH)
- [ ] DTOs: no leak of other users' `userId`; match `RoutineSummary` where possible
- [ ] Tests: own CRUD; system mutate 403/404; foreign 404; invalid exerciseId; list = system + own; ownership regression
- [ ] API notes in this doc + DTO deltas in PR body

## REST (FE contract)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/routines` | existing — system + own |
| GET | `/api/routines/[id]` | existing — accessible only |
| POST | `/api/routines` | create custom |
| PATCH | `/api/routines/[id]` | update own custom |
| DELETE | `/api/routines/[id]` | soft-delete own custom |

Create/update body:

```json
{
  "name": "string",
  "description": "string?",
  "kind": "gym | home",
  "restSeconds": "number?",
  "exercises": [
    { "exerciseId": "string", "sortOrder": 0, "targetSets": 3, "targetReps": 10 }
  ]
}
```

Media: URL fields only on custom exercises (`imageUrl` / `videoUrl`). No dedicated media route unless existing PATCH is insufficient.

## Policy

Ownership unchanged: `isSystem || userId === currentUser` (`lib/auth/ownership.ts`). Foreign custom → 404. System mutate → 403/404 as designed.

## Verify

```bash
npm run lint
npm run typecheck
npm test
```
