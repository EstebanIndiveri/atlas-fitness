# Sesión guiada — Skip / Hold

**Branches:** `feature/session-skip-hold` (FE, PR #29) · `feature/session-skip-hold-api` (BE, this PR) → `develop`  
**Alcance BE:** persistencia de cola, idempotencia `clientMutationId`, `POST skip` / `POST hold`, `queue` en GET workout.  
**Fuera de alcance:** UI FE, Mini App, OCR, alta de ejercicio custom.

Status: **WIP** — rutas stub + contrato alineado con FE; persistencia y tests TDD en este PR.

## Producto

En sesión guiada activa (`endedAt === null`):

1. **Saltar** — saca el ejercicio actual de la cola de esta sesión (no vuelve).
2. **Posponer (hold)** — lo mueve al final de la cola (sí vuelve). **No borra series**.
3. La cola es el estado de workout (ordenable). Hold = reordenar (deferir).
4. Tras skip/hold, la sugerencia siguiente sigue ADR-003 (Gemini server-side + fallback `sort_order`).
5. Workout no activo → **400** `{ code: "VALIDATION", message: "El entrenamiento no está activo." }`

Media preview (https + ≤2048) no se toca.

## Contrato (FE + BE)

Idempotencia: `clientMutationId`. Mismo id + mismos args, scoped a `workoutId` + `action` → `200` + `duplicate: true` y la misma cola.

| Método | Path | Body |
|---|---|---|
| POST | `/api/workouts/:id/skip` | `{ exerciseId, clientMutationId }` |
| POST | `/api/workouts/:id/hold` | `{ exerciseId, clientMutationId }` |

`exerciseId` = ejercicio **actual** (o pendiente) de la cola.

**200**

```json
{
  "action": "skip",
  "clientMutationId": "…",
  "duplicate": false,
  "queue": {
    "pendingExerciseIds": [20, 30],
    "skippedExerciseIds": [10],
    "heldExerciseIds": []
  },
  "suggestion": {
    "source": "fallback",
    "isLast": false,
    "nextExerciseId": 20,
    "message": "Siguiente según el orden de la rutina."
  },
  "sets": []
}
```

- `queue.pendingExerciseIds`: restantes, en orden de trabajo. Hold mueve el id al final.
- `queue.skippedExerciseIds`: saltados en esta sesión (no vuelven).
- `queue.heldExerciseIds`: subset de pending que fueron pospuestos (siguen en pending).
- `suggestion`: mismo shape que `POST /api/workouts/:id/next-exercise`. Remaining para Gemini/fallback = pending (skip fuera; hold al final).
- `sets` opcional: **mismos** sets (ids, `weightKg` decimal string, reps). Skip/hold no hacen DELETE ni PATCH de sets.

**400** workout no activo (`endedAt` set, soft-deleted, o no es el activo):

```json
{ "code": "VALIDATION", "message": "El entrenamiento no está activo." }
```

Otros: `401 UNAUTHORIZED`, `404 NOT_FOUND` (inexistente / soft-deleted), `403 FORBIDDEN` (ajeno, mismo patrón que GET workout), `VALIDATION` por body inválido.

**GET `/api/workouts/:id`:** campo `queue` con el mismo shape (persistido en el workout). Si falta, FE reconstruye pending = rutina − completados y **no** recuerda skipped/held tras reload.

## BE (este PR)

- Auth: `requireAuth` + `workout.userId === session.userId`.
- Persistencia: JSON de cola en `workouts` + store de idempotencia scoped a workout + action.
- Sugerencia post skip/hold: ADR-003 sobre pending restantes (no muta sets).
- Tests: skip avanza; hold reaparece al final; sets intactos; no activo → 400; ajeno → 403; duplicado `clientMutationId` → `duplicate: true`.

## FE (PR #29)

- Cliente tipado: `lib/session/client.ts`
- Cola pura: `lib/session/queue.ts` (skip avanza, hold reaparece, sets no se mutan)
- UI: `components/session/SessionQueueActions.tsx` en `/dashboard/session/[workoutId]`
- Copy es-AR en `lib/copy/session.ts`
