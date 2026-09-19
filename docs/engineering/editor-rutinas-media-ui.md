# Editor rutinas + media (FE)

Branch: `feature/editor-rutinas-media-ui` ← `develop`  
Owner: FE. BE write API lives on `feature/editor-rutinas-media` (PR #27).

## UI

- List: `/dashboard/routines`
- Create: `/dashboard/routines/new`
- Edit/view: `/dashboard/routines/[id]/edit`
- Entry: sesión (`Gestionar rutinas`) y ajustes

Form fields: name, description, kind (`gym` | `home`), restSeconds (routine-level), ordered exercises with targetSets/targetReps, add/reorder/remove.

Media: image/video preview from catalog URLs; empty placeholder; **file upload disabled** (no upload endpoint). Custom exercises can PATCH `imageUrl` / `videoUrl` via existing `/api/exercises/[id]`.

Ownership: GET 404 → “Rutina no encontrada” (no leak). System mutate 403 → read-only. VALIDATION → API message.

## BE contract consumed

| Method | Path | FE use |
|---|---|---|
| GET | `/api/routines` | list |
| GET | `/api/routines/[id]` | edit load |
| POST | `/api/routines` | create (gap until BE) |
| PATCH | `/api/routines/[id]` | update (gap until BE) |
| DELETE | `/api/routines/[id]` | delete (gap until BE) |
| GET | `/api/exercises` | catalog picker |
| PATCH | `/api/exercises/[id]` | custom media URLs |

Create/update body:

```json
{
  "name": "string",
  "description": "string | null",
  "kind": "gym | home",
  "restSeconds": 90,
  "exercises": [
    { "exerciseId": 1, "sortOrder": 0, "targetSets": 3, "targetReps": 10 }
  ]
}
```

## Gaps (do not invent BE)

1. **POST/PATCH/DELETE `/api/routines`** — not on `develop` yet. UI calls them; 405 → copy explaining the gap.
2. **`isSystem` on `RoutineSummary`** — optional; when missing, edit is allowed until 403.
3. **Per-exercise rest** — API only has `restSeconds` on the routine. Form does not invent a field.
4. **Media upload** — no file POST. Control disabled + TODO copy. URLs only (ADR-001).

## Verify

```bash
npm run lint
npm run typecheck
npm test
npx playwright test e2e/routines-editor.spec.ts
```
