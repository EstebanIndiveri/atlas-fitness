# Sesión guiada — Skip / Hold (FE)

**Branch:** `feature/session-skip-hold` → `develop`  
**Alcance:** FE Must. BE posee las rutas; este documento fija el contrato esperado si el draft BE aún no existe.

## Producto

En sesión guiada activa (`endedAt === null`):

1. **Saltar** — saca el ejercicio actual de la cola de esta sesión (no vuelve).
2. **Posponer (hold)** — lo mueve al final de la cola (sí vuelve). **No borra series**.
3. La cola es el estado de workout (ordenable). Hold = reordenar (deferir).
4. Tras skip/hold, la sugerencia siguiente sigue ADR-003 (Gemini server-side + fallback `sort_order`).
5. Workout no activo → **400** `{ code, message }` visible en UI.

Media preview (https + ≤2048) no se toca.

## Contrato esperado (BE)

Idempotencia: `clientMutationId` (UUID). Mismo id + mismos args → `200` + `duplicate: true` y la misma cola.

| Método | Path | Body |
|---|---|---|
| POST | `/api/workouts/:id/skip` | `{ exerciseId, clientMutationId }` |
| POST | `/api/workouts/:id/hold` | `{ exerciseId, clientMutationId }` |

`exerciseId` = ejercicio **actual** de la cola.

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
- `sets` opcional: **mismos** sets (ids, `weight_kg` decimal string, reps). Skip/hold no hacen DELETE ni PATCH de sets.

**400** workout no activo (`endedAt` set, soft-deleted, o no es el activo):

```json
{ "code": "VALIDATION", "message": "El entrenamiento no está activo." }
```

Otros: `401 UNAUTHORIZED`, `404 NOT_FOUND`, `VALIDATION` por body inválido.

**GET `/api/workouts/:id` (opcional, alineación):** campo `queue` con el mismo shape. Si falta, FE reconstruye pending = rutina − completados (target sets) y **no** recuerda skipped/held tras reload hasta que BE persista la cola.

## FE

- Cliente tipado: `lib/session/client.ts`
- Cola pura: `lib/session/queue.ts` (skip avanza, hold reaparece, sets no se mutan)
- UI: `components/session/SessionQueueActions.tsx` en `/dashboard/session/[workoutId]`
- Copy es-AR en `lib/copy/session.ts`

## Fuera de alcance

Mini App · OCR · alta de ejercicio custom · drag-and-drop extra (hold es el reorder Must).
