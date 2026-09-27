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

## Routine Coach proposal

`/dashboard/routines/coach` creates a single-session proposal from the Routine Engine V2 context: goal, optional focus areas and available equipment, location, level, and explicit session duration. The review shows the proposal source (Gemini or fallback), its short reason, exercise instructions, catalog media, and editable sets/reps; exercises can also be removed or replaced.

Review remains client-side. No routine is persisted until **Crear esta rutina** calls the existing `POST /api/routines` contract with the edited proposal. Replacement candidates are returned by `POST /api/routines/coach?mode=candidates`, using the same authenticated catalog and canonical eligibility filter as generation; compatibility rules are not repeated in the client.

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
