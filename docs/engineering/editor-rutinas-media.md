# Editor rutinas + media (BE API/schema)

Branch: `feature/editor-rutinas-media` · base `develop`  
Status: implemented (BE only). FE UI is `feature/editor-rutinas-media-ui`.

No file upload/S3. Media is URL fields on custom exercises.

## Checklist

- [x] `POST /api/routines` — create custom (`isSystem=false`, `userId=current`)
- [x] `PATCH /api/routines/[id]` — update own custom only (404 foreign / 403 system)
- [x] `DELETE /api/routines/[id]` — soft-delete own custom only
- [x] Replace ordered `routine_exercises` on create/update (transactional; unique `sort_order`)
- [x] Validate every `exerciseId` via `requireAccessibleExercise`; reject empty list
- [x] Spanish `AppError` messages
- [x] Custom exercise `imageUrl` / `videoUrl` on existing POST/PATCH (no `/media` route)
- [x] DTOs: no `userId`; `RoutineSummary` plus additive `isSystem`
- [x] Tests: own CRUD; system mutate 403; foreign 404; invalid exerciseId; list = system + own; ownership regression; media URLs

## REST (FE contract)

Auth required on all routes.

| Method | Path | Status | Notes |
|---|---|---|---|
| GET | `/api/routines` | 200 | system + own (unchanged) |
| GET | `/api/routines/[id]` | 200 / 404 | accessible only |
| POST | `/api/routines` | 201 | create custom |
| PATCH | `/api/routines/[id]` | 200 | update own custom; omit `exercises` to keep current list |
| DELETE | `/api/routines/[id]` | 200 `{ success: true }` | soft-delete own custom |

### Create / update body

```json
{
  "name": "Push casa",
  "description": "opcional",
  "kind": "gym",
  "restSeconds": 90,
  "exercises": [
    { "exerciseId": 12, "sortOrder": 0, "targetSets": 3, "targetReps": 10 }
  ]
}
```

- `kind`: `"gym"` \| `"home"`
- `exerciseId`: **number** (same as `RoutineSummary.exercises[].exerciseId`, not string)
- `exercises` required on POST (`min 1`); optional on PATCH; empty array → 400
- `sortOrder` unique within the payload (integer ≥ 0)
- `targetSets` / `targetReps` integers ≥ 1
- `restSeconds` optional integer 0–3600; default 90 on create
- Duplicate routine slug (same name for the same user) → 409 `CONFLICT`

### Errors (Spanish)

| Case | HTTP | `code` |
|---|---|---|
| Unauthenticated | 401 | `UNAUTHORIZED` |
| Invalid JSON / body | 400 | `VALIDATION` |
| Empty `exercises` | 400 | `VALIDATION` |
| Duplicate `sortOrder` | 400 | `VALIDATION` |
| Unknown / foreign `exerciseId` | 404 | `NOT_FOUND` (`Ejercicio no encontrado`) |
| Foreign routine | 404 | `NOT_FOUND` (`Rutina no encontrada`) |
| Mutate system routine | 403 | `FORBIDDEN` (`No puedes modificar una rutina del sistema`) |
| Slug already taken | 409 | `CONFLICT` |

Ownership unchanged: `isSystem \|\| userId === currentUser` (`lib/auth/ownership.ts`).

## DTO deltas

`RoutineSummary` now includes additive `isSystem: boolean` so FE can hide edit/delete on seed routines. Still **omits `userId`**. Exercise items unchanged (`imageUrl` / `videoUrl` already present).

Custom exercise media stays on `POST /api/exercises` and `PATCH /api/exercises/[id]`:

```json
{ "imageUrl": "https://…", "videoUrl": "https://…" }
```

Nullable to clear. Invalid URL → 400. No dedicated `/media` route.

## Verify

```bash
npm run lint
npm run typecheck
npm test
```
