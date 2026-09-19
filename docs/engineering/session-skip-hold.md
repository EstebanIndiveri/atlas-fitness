# Sesión guiada — Skip / Hold

**Branches:** `feature/session-skip-hold` (FE, PR #29) · `feature/session-skip-hold-api` (BE, PR #30) → `develop`  
**Alcance BE:** persistencia de cola, idempotencia `clientMutationId`, `POST skip` / `POST hold`, `queue` en GET workout.  
**Fuera de alcance:** UI FE, Mini App, OCR, alta de ejercicio custom.

Status: **implemented (BE)** — cola persistida + tests unitarios.

## Producto

En sesión guiada activa (`endedAt === null`):

1. **Saltar** — saca el ejercicio actual de la cola de esta sesión (no vuelve).
2. **Posponer (hold)** — lo mueve al final de la cola (sí vuelve). **No borra series**.
3. La cola es el estado de workout (ordenable). Hold = reordenar (deferir).
4. Tras skip/hold, la sugerencia siguiente sigue ADR-003 (Gemini server-side + fallback `sort_order` sobre **pending**).
5. Workout no activo → **400** `{ code: "VALIDATION", message: "El entrenamiento no está activo." }`

Media preview (https + ≤2048) no se toca.

## Contrato (FE + BE)

Idempotencia: `clientMutationId`. Mismo id + mismos args, scoped a `workoutId` + `action` → `200` + `duplicate: true` y la misma cola. Mismo id con `exerciseId` distinto → `409 CONFLICT`.

| Método | Path | Body |
|---|---|---|
| POST | `/api/workouts/:id/skip` | `{ exerciseId, clientMutationId }` |
| POST | `/api/workouts/:id/hold` | `{ exerciseId, clientMutationId }` |

`exerciseId` = ejercicio **pendiente** de la cola.

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
- `sets`: **mismos** sets (ids, `weightKg` decimal string, reps). Skip/hold no hacen DELETE ni PATCH de sets.

**400** workout no activo (`endedAt` set) o `exerciseId` fuera de pending:

```json
{ "code": "VALIDATION", "message": "El entrenamiento no está activo." }
```

Otros: `401 UNAUTHORIZED`, `404 NOT_FOUND` (inexistente / soft-deleted), `403 FORBIDDEN` (ajeno, mismo patrón que GET workout), `VALIDATION` por body inválido o workout sin rutina.

**GET `/api/workouts/:id`:** campo `queue` con el mismo shape (reconstruido desde `workouts.queue_json` + series completadas). Soft-deleted → 404, no 400.

## BE

- Auth: `requireAuth` + `workout.userId === session.userId`.
- Persistencia: `workouts.queue_json` + tabla `workout_queue_mutations` (unique `workout_id + action + client_mutation_id`).
- Cola pura: `lib/session/queue.ts` (misma semántica que FE).
- Servicio: `lib/services/session-queue.ts`.
- Sugerencia post skip/hold y `POST next-exercise`: ADR-003 sobre pending.
- Tests: skip avanza; hold reaparece al final; sets intactos; no activo → 400; ajeno → 403; duplicado `clientMutationId` → `duplicate: true`; GET sobrevive reload.

## FE (PR #29)

- Cliente tipado: `lib/session/client.ts`
- Cola pura: `lib/session/queue.ts` (skip avanza, hold reaparece, sets no se mutan)
- UI: `components/session/SessionQueueActions.tsx` en `/dashboard/session/[workoutId]`
- Copy es-AR en `lib/copy/session.ts`
