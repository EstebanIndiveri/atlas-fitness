# Editor rutinas + media (FE)

Branch: `feature/editor-rutinas-media-ui` rebased onto `feature/editor-rutinas-media` (BE PR #27).  
PR: https://github.com/EstebanIndiveri/atlas-fitness/pull/26

## UI

- List: `/dashboard/routines`
- Create: `/dashboard/routines/new`
- Edit/view: `/dashboard/routines/[id]/edit`
- Entry: sesión (`Gestionar rutinas`) y ajustes

Form: name, description, kind (`gym` | `home`), restSeconds (routine-level), ordered exercises with targetSets/targetReps.

Media: URL preview + empty placeholder. **https-only** client scheme gate (`isHttpsMediaUrl`). Length 2048 owned by BE `normalizeMediaUrl` (hint only in FE). File upload disabled.

Ownership: `RoutineSummary.isSystem` required. System → read-only. Foreign GET/PATCH/DELETE → 404. VALIDATION → API message.

## BE contract

| Method | Path | FE |
|---|---|---|
| GET | `/api/routines` | list (system + own) |
| GET | `/api/routines/[id]` | edit load |
| POST | `/api/routines` | create → 201 |
| PATCH | `/api/routines/[id]` | own custom; system 403; foreign 404 |
| DELETE | `/api/routines/[id]` | own custom; system 403; foreign 404 |
| GET | `/api/exercises` | catalog |
| PATCH | `/api/exercises/[id]` | custom `imageUrl`/`videoUrl` (https\|null) |

Body: `{ name, description?, kind, restSeconds?, exercises: [{ exerciseId, sortOrder, targetSets, targetReps }] }`
