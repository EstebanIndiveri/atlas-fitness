# Atlas Adaptive Core V1 — FE↔BE contracts

**Estado:** consenso técnico para implementación posterior, no migración ni app code.  
**Fecha:** 2026-09-19  
**Scope:** Track B / Fase 1 del handoff `docs/backlog/handoff-atlas-adaptive-core.md`.  
**Zona horaria canónica:** `America/Argentina/Cordoba`.

## 0. Fuentes y patrones existentes que este contrato respeta

- `docs/backlog/handoff-atlas-adaptive-core.md`: define el loop Must `Daily Check-in → Today Plan → Coach Adaptation → Active Workout → Post-workout → Progress`, la DATA HONESTY RULE, Córdoba como timezone, fallback determinístico y la obligación de construir Coach adaptation sobre Skip/Hold.
- `lib/db/schema.ts`: usa Drizzle `sqliteTable`, columnas snake_case en DB y camelCase en TS, `integer(..., { mode: 'timestamp' })`, `deleted_at` para soft delete, `uniqueIndex(...)` para invariantes como un check-in por día, y tipos `$inferSelect/$inferInsert` exportados.
- `lib/services/*.ts`: las rutas son delgadas y delegan reglas a services. Ejemplos: `workouts.createWorkout()` valida rutina accesible y usa índice único parcial para una sesión activa; `daily-checkins.upsertDailyCheckin()` encapsula idempotencia por `(user_id, local_date)`; `routines.listRoutines()` excluye soft delete y aplica ownership.
- `types/errors.ts`: errores HTTP con `{ code, message }` y unión tipada. V1 debe extender esa unión, no inventar formatos por endpoint.
- `app/api/**/route.ts`: patrón Next App Router `requireAuth(request) → Zod safeParse/parse → service → NextResponse.json(...) → handleApiError(error)`.
- Validadores Zod existentes: schemas locales en rutas (`createRoutineSchema`, `createWorkoutSchema`, `createSetSchema`) con `VALIDATION` para JSON inválido o payload fuera de contrato.
- `docs/architecture/ADR-003-gemini-guided-session.md`: Gemini es server-side, opcional, validado, y todo flujo crítico tiene fallback determinista.
- `docs/architecture/ADR-004-sessions.md`: distingue sesión de auth (`sessions`) de sesión guiada de entrenamiento (`workouts`); Adaptive Core no debe crear una tabla paralela llamada `sessions` para workouts.
- `docs/engineering/session-skip-hold.md`: documento esperado para el contrato de cola Skip/Hold. En el snapshot `origin/develop` usado para este consenso no está presente; el handoff sí fija el contrato esperado: `lib/session/queue.ts`, `types/session-queue.ts`, `clientMutationId`, concurrencia e idempotencia. Este documento asume que Track A entrega esa cola y no permite un mecanismo paralelo.

### 0.1 As-built deltas (gobiernan sobre los sketches ilustrativos)

Este documento se escribió como propuesta previa a la implementación. La capa de datos V1 ya fue implementada y mergeada en `develop` y, donde el código difiere de los sketches de más abajo, **manda el código**. Deltas relevantes:

- **Tabla de asignaciones:** el sketch la llama `training_plan_assignments`; lo shipeado es **`scheduled_routines`** (PR #38). `training_plans` incluye además `name` e `is_active` (índice único parcial de un plan activo por usuario).
- **`dayOfWeek`:** **0..6, 0=Sunday..6=Saturday** (`Date.getDay()`), no ISO 1..7. Ver §11.5.
- **Check-in:** un único service `recordDailyCheckIn` (upsert por `(userId, localDate)`, `energy`/`note` nullable, actualiza streaks). El viejo `upsertDailyCheckin`/`daily-checkins.ts` queda consolidado en él.
- **Resolver de hoy:** `resolveTodayScheduledRoutine(userId, now?)` devuelve la unión discriminada `TodayScheduledRoutineResult` (`no_plan | rest_day | workout | routine_missing`); es la fuente de verdad del estado "today" (los `TodayWorkoutState` de más abajo son la vista de producto derivada).
- **CoachRecommendation:** persistida (PR #41), con idempotencia y máquina de estados `pending → accepted | rejected`.

Las decisiones de producto que faltaban se resolvieron en §11.

## 1. Principios de contrato V1

1. **Datos reales únicamente.** Todo valor visible debe tener fuente explícita.
2. **Mood y energy son dimensiones separadas.** Mood describe ánimo; energy describe disponibilidad física percibida. No se promedian ni se convierten en score.
3. **Córdoba manda.** `localDate` y `dayOfWeek` se calculan server-side con `lib/time/cordoba.ts` (`cordobaLocalDate`) o helper equivalente, nunca con UTC ni hora del cliente.
4. **Rutas delgadas, services con reglas.** API routes validan/auth/delegan; services resuelven estados, idempotencia y DB.
5. **Coach propone; no muta en silencio.** Preview persiste una recomendación trazable; accept aplica transformación de cola con `clientMutationId`.
6. **Gemini mejora, no desbloquea.** Si Gemini falta/falla/devuelve JSON inválido, fallback determinístico produce una adaptación real.
7. **V1 no es ML.** El copy correcto es “Atlas usa tu último resultado”, no “Atlas aprende”.

```ts
type MetricSource = 'user_input' | 'atlas_computed' | 'external_integration' | 'ai_recommendation';

type Metric<T> = {
  value: T;
  source: MetricSource;
};
```

## 2. Error contract compartido

`types/errors.ts` debe extenderse en implementación posterior manteniendo `{ code, message }`. La extensión debe hacerse sobre la unión exportada `ErrorCode`, no como una unión paralela que `AppError` no pueda recibir:

```ts
export type ErrorCode =
  // existentes
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'RATE_LIMIT'
  | 'SERVICE_UNAVAILABLE'
  // Adaptive Core V1
  | 'CHECKIN_ALREADY_EXISTS'
  | 'CHECKIN_NOT_FOUND'
  | 'TRAINING_PLAN_NOT_FOUND'
  | 'TRAINING_PLAN_EMPTY'
  | 'INVALID_DAY_OF_WEEK'
  | 'TODAY_IS_REST_DAY'
  | 'ROUTINE_UNAVAILABLE'
  | 'WORKOUT_ALREADY_COMPLETED_TODAY'
  | 'ACTIVE_WORKOUT_EXISTS'
  | 'QUEUE_CONFLICT'
  | 'RECOMMENDATION_NOT_FOUND'
  | 'RECOMMENDATION_ALREADY_DECIDED'
  | 'RECOMMENDATION_EXPIRED'
  | 'RECOMMENDATION_QUEUE_MISMATCH'
  | 'POST_WORKOUT_FEEDBACK_NOT_FOUND'
  | 'POST_WORKOUT_FEEDBACK_ALREADY_EXISTS';

interface ApiError {
  code: ErrorCode;
  message: string;
}
```

`lib/auth/middleware.ts` / `handleApiError` también debe actualizarse en el mismo cambio para mapear estos códigos a HTTP. No debe quedar un código nuevo que caiga por accidente como 500.

HTTP mapping:

| Code family | HTTP | Uso |
|---|---:|---|
| `UNAUTHORIZED` | 401 | `requireAuth` falla |
| `FORBIDDEN` | 403 | Recurso propio válido pero acción prohibida |
| `NOT_FOUND`, `*_NOT_FOUND` | 404 | Recurso inexistente o ajeno cuando no se debe filtrar existencia |
| `VALIDATION`, `INVALID_DAY_OF_WEEK` | 400 | Payload inválido, JSON inválido, rango inválido |
| `CONFLICT`, `*_ALREADY_*`, `QUEUE_CONFLICT`, `ACTIVE_WORKOUT_EXISTS` | 409 | Estado válido pero no aplicable ahora |
| `SERVICE_UNAVAILABLE` | 503 | Solo dependencias no recuperables; Gemini no debería dispararlo en preview porque hay fallback |

## 3. DailyCheckIn

### 3.1 Data model sketch

Extiende la tabla existente `daily_checkins` sin cambiar su semántica de mood. `energy` es nuevo y obligatorio para Adaptive Core V1.

```ts
export const dailyCheckins = sqliteTable(
  'daily_checkins',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull().references(() => users.id),
    localDate: text('local_date').notNull(), // YYYY-MM-DD en America/Argentina/Cordoba
    mood: integer('mood').notNull(), // 1..5, user_input
    energy: integer('energy').notNull(), // 1..5, user_input; no porcentaje ni score
    note: text('note'), // opcional, max 280 chars
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    uniqueUserDate: uniqueIndex('daily_checkins_user_id_local_date_unique').on(
      table.userId,
      table.localDate,
    ),
  }),
);
```

Reglas:

- Una fila por `(user_id, local_date)` en Córdoba.
- `mood` y `energy` son enteros 1..5 con labels de producto, no métricas biométricas.
- El valor mostrado de energía debe serializarse como `Metric<EnergyLevel>` con `source: 'user_input'`.
- No mostrar “80% energía”, “recovery”, “recuperación completa” ni inferencias sin fuente.
- Compatibilidad con filas existentes mood-only: la migración no debe inventar `energy`. Implementación recomendada: agregar `energy` nullable primero, exigir `energy` en el endpoint Adaptive Core, serializar filas legacy como `checkIn: null` para el flujo de “sin check-in completo”, y completar `energy NOT NULL` solo después de backfill por re-prompt explícito del usuario. Si se decide mantener `energy` nullable permanentemente, el DTO Adaptive debe seguir devolviendo `null` hasta que ambas dimensiones existan.

### 3.2 FE↔BE types

```ts
type CheckInScale = 1 | 2 | 3 | 4 | 5;

type MoodLabel = 'muy_bajo' | 'bajo' | 'neutral' | 'bueno' | 'muy_bueno';
type EnergyLabel = 'muy_baja' | 'baja' | 'media' | 'alta' | 'muy_alta';

interface DailyCheckInDto {
  id: number;
  userId: number;
  localDate: string;
  mood: Metric<{ value: CheckInScale; label: MoodLabel }>;
  energy: Metric<{ value: CheckInScale; label: EnergyLabel }>;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UpsertTodayCheckInRequest {
  mood: CheckInScale;
  energy: CheckInScale;
  note?: string | null;
}

interface GetTodayCheckInResponse {
  localDate: string;
  checkIn: DailyCheckInDto | null;
}
```

### 3.3 Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/adaptive/check-ins/today` | Sí | Devuelve el check-in de hoy o `null` |
| `PUT` | `/api/adaptive/check-ins/today` | Sí | Upsert idempotente del check-in de hoy |

`PUT` response: `200` si actualiza, `201` si crea. Si se prefiere seguir el patrón existente de `upsertDailyCheckin()`, el service puede devolver `{ created: boolean, checkIn }` y la route decide status.

Errores específicos:

- `VALIDATION`: mood/energy fuera de 1..5, note > 280, body no objeto.
- `CHECKIN_ALREADY_EXISTS`: solo si PO/Arch decide cambiar de upsert a create-only. Recomendación V1: **upsert** para UX simple.

## 4. TrainingPlan V1

### 4.1 Boundary V1

TrainingPlan V1 es solo asignación semanal:

```ts
{
  userId: number,
  routineAssignments: [{ dayOfWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7, routineId: number }]
}
```

`dayOfWeek` usa la convención JS `Date.getDay()`: domingo `0`, lunes `1`, martes `2`, miércoles `3`, jueves `4`, viernes `5`, sábado `6`. Es la convención shipeada (`scheduled_routines`, PR #38) y se calcula server-side en Córdoba. (El sketch previo con ISO 1..7 quedó superado; ver §0 y §11.)

**Won't V1:** periodización, mesociclos, microciclos, deload, volumen por grupo muscular, progresión automática, objetivos por fase. Eso es V2.

### 4.2 Data model sketch

```ts
export const trainingPlans = sqliteTable(
  'training_plans',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull().references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (table) => ({
    uniqueActiveUserPlan: uniqueIndex('training_plans_user_id_active_unique')
      .on(table.userId)
      .where(sql`${table.deletedAt} IS NULL`),
  }),
);

export const trainingPlanAssignments = sqliteTable(
  'training_plan_assignments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    trainingPlanId: integer('training_plan_id').notNull().references(() => trainingPlans.id),
    dayOfWeek: integer('day_of_week').notNull(), // 1..7 ISO
    routineId: integer('routine_id').notNull().references(() => routines.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    uniquePlanDay: uniqueIndex('training_plan_assignments_plan_day_unique').on(
      table.trainingPlanId,
      table.dayOfWeek,
    ),
  }),
);

export type TrainingPlan = typeof trainingPlans.$inferSelect;
export type NewTrainingPlan = typeof trainingPlans.$inferInsert;
export type TrainingPlanAssignment = typeof trainingPlanAssignments.$inferSelect;
export type NewTrainingPlanAssignment = typeof trainingPlanAssignments.$inferInsert;
```

No `deleted_at` en assignments V1: actualizar plan reemplaza assignments en transacción, igual que `routines.replaceRoutineExercises()`.

### 4.3 FE↔BE types

```ts
type IsoDayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

type TodayWorkoutState =
  | 'no_plan'
  | 'rest_day'
  | 'routine_unavailable'
  | 'active_workout'
  | 'completed_today'
  | 'ready';

interface TrainingPlanAssignmentDto {
  dayOfWeek: IsoDayOfWeek;
  routineId: number;
  routineName: string;
}

interface TrainingPlanDto {
  id: number;
  userId: number;
  routineAssignments: TrainingPlanAssignmentDto[];
  createdAt: string;
  updatedAt: string;
}

interface UpsertTrainingPlanRequest {
  routineAssignments: Array<{
    dayOfWeek: IsoDayOfWeek;
    routineId: number;
  }>;
}

interface TodayWorkoutResponse {
  localDate: string;
  dayOfWeek: IsoDayOfWeek;
  state: TodayWorkoutState;
  reason: string;
  plan: TrainingPlanDto | null;
  routine: RoutineSummary | null;
  activeWorkoutId: number | null;
  completedWorkoutIdsToday: number[];
  canStart: boolean;
  canStartDoubleSession: boolean;
  canAdapt: boolean;
  hasHistory: boolean;
  sourceData: {
    plan: Metric<'active_plan' | 'missing_plan'>;
    schedule: Metric<'assigned_day' | 'rest_day'>;
    routine: Metric<'routine_active' | 'routine_soft_deleted' | 'not_applicable'>;
    completion: Metric<'none_today' | 'completed_today' | 'active_workout'>;
    history: Metric<'has_history' | 'no_history'>;
  };
}
```

### 4.4 Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/adaptive/training-plan` | Sí | Plan activo o `null` |
| `PUT` | `/api/adaptive/training-plan` | Sí | Reemplaza plan semanal activo en transacción |
| `GET` | `/api/adaptive/today/workout` | Sí | Resuelve el estado de entrenamiento de hoy |
| `POST` | `/api/adaptive/today/workout/start` | Sí | Crea workout desde resolución de hoy |

`POST /start` request:

```ts
interface StartTodayWorkoutRequest {
  allowDoubleSession?: boolean;
  clientMutationId?: string;
}

interface StartTodayWorkoutResponse {
  workoutId: number;
  routineId: number;
  localDate: string;
  doubleSession: boolean;
}
```

`clientMutationId` es recomendable en `start` para doble tap mobile, aunque el índice `workouts_user_id_active_unique` ya bloquea doble sesión activa.

### 4.5 Algoritmo “today’s workout”

1. Calcular `localDate = cordobaLocalDate(now)` server-side.
2. Calcular `dayOfWeek` (0..6, `getDay()`) en Córdoba desde el mismo instante.
3. Cargar el plan activo `training_plans.deleted_at IS NULL` del usuario.
   - Si no existe: `state = 'no_plan'`, `canStart = false`, `reason = 'Todavía no tenés un plan.'`.
4. Buscar assignment para `dayOfWeek`.
   - Si no existe: `state = 'rest_day'`, `canStart = false`, `reason = 'Hoy tu plan marca descanso.'`.
5. Cargar rutina asignada aplicando ownership (`isSystem || userId === currentUser`) y `routines.deleted_at IS NULL`.
   - Si falta o está soft-deleted: `state = 'routine_unavailable'`, `canStart = false`, `reason = 'La rutina asignada ya no está disponible.'`.
6. Cargar workout activo del usuario (`ended_at IS NULL AND deleted_at IS NULL`).
   - Si existe y su `routineId` coincide: `state = 'active_workout'`, `activeWorkoutId = id`, `canStart = false`.
   - Si existe y no coincide: `state = 'active_workout'`, `activeWorkoutId = id`, `canStart = false`, `reason = 'Ya tenés un entrenamiento en curso.'`.
7. Cargar workouts del usuario cuya fecha local de `startedAt` o `endedAt` sea `localDate`, excluyendo `deleted_at`.
   - Si hay uno o más `endedAt !== null` para esa rutina: `state = 'completed_today'`, `completedWorkoutIdsToday = [...]`, `canStart = false`, `canStartDoubleSession = true`.
   - La UI debe mostrar “Ya completaste este entrenamiento hoy” y requerir acción explícita para segunda sesión.
8. Si no hay completado hoy: `state = 'ready'`, `canStart = true`.
9. `hasHistory` se calcula con existencia real de workouts finalizados previos o sets previos. Si no hay historial: no bloquear; mostrar empty state “Tu progreso empieza con tu primera sesión.”.
10. `POST /start` solo crea si resolución actual es `ready`, o si es `completed_today` y `allowDoubleSession === true`. Nunca permite doble sesión activa por el índice único existente.

Errores específicos:

- `TRAINING_PLAN_EMPTY` / `VALIDATION`: `PUT`/`POST` con array vacío se **rechaza** (decisión PO §11.3). Un plan exige ≥1 día asignado; no existe el plan implícito de "7 días de descanso".
- `INVALID_DAY_OF_WEEK`: `dayOfWeek` fuera de 0..6.
- `ROUTINE_UNAVAILABLE`: routineId inexistente, ajeno o soft-deleted.
- `WORKOUT_ALREADY_COMPLETED_TODAY`: `POST /start` sin `allowDoubleSession` cuando ya completó hoy.
- `ACTIVE_WORKOUT_EXISTS`: ya hay workout abierto.

## 5. CoachRecommendation

### 5.1 Boundary y fuente de verdad

CoachRecommendation V1 es una recomendación persistida, auditable y aplicable como transformación sobre la cola de sesión existente de Skip/Hold. No reemplaza `workouts`, `routine_exercises`, `workout_sets` ni crea una cola paralela.

Debe persistir:

```ts
{
  original,
  adapted,
  reason,
  sourceData,
  suggestedChanges,
  status: 'pending' | 'accepted' | 'rejected',
  timestamp
}
```

### 5.2 Data model sketch

```ts
export const coachRecommendations = sqliteTable(
  'coach_recommendations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull().references(() => users.id),
    workoutId: integer('workout_id').references(() => workouts.id),
    routineId: integer('routine_id').notNull().references(() => routines.id),
    localDate: text('local_date').notNull(),
    clientMutationId: text('client_mutation_id').notNull(),
    status: text('status').notNull().default('pending'), // pending|accepted|rejected
    originalJson: text('original_json').notNull(),
    adaptedJson: text('adapted_json').notNull(),
    reason: text('reason').notNull(),
    sourceDataJson: text('source_data_json').notNull(),
    suggestedChangesJson: text('suggested_changes_json').notNull(),
    engine: text('engine').notNull(), // deterministic|gemini
    acceptedAt: integer('accepted_at', { mode: 'timestamp' }),
    rejectedAt: integer('rejected_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    uniqueUserMutation: uniqueIndex('coach_recommendations_user_client_mutation_unique').on(
      table.userId,
      table.clientMutationId,
    ),
    userDateIdx: index('coach_recommendations_user_local_date_idx').on(table.userId, table.localDate),
  }),
);

export type CoachRecommendation = typeof coachRecommendations.$inferSelect;
export type NewCoachRecommendation = typeof coachRecommendations.$inferInsert;
```

JSON columns are acceptable for V1 because recommendation payloads are audit snapshots, not relational query primitives. Implementation must parse with Zod in services and catch invalid JSON; no raw `JSON.parse` without try/catch.

### 5.3 Queue transformation contract

This contract reuses the Track A queue model (`types/session-queue.ts`) and its idempotent mutation service. Names below are contractual placeholders to align implementation; they must map to the actual Track A types when merged.

```ts
type QueueChangeKind = 'remove_exercise' | 'reduce_sets' | 'reduce_reps' | 'keep_exercise' | 'reorder_exercise';

interface SessionQueueSnapshot {
  workoutId: number;
  routineId: number;
  version: number;
  items: Array<{
    queueItemId: string;
    routineExerciseId: number;
    exerciseId: number;
    exerciseName: string;
    muscleGroup: string;
    sortOrder: number;
    targetSets: number;
    targetReps: number;
    status: 'pending' | 'held' | 'skipped' | 'completed';
  }>;
}

interface SessionQueueTransformation {
  clientMutationId: string;
  baseQueueVersion: number;
  changes: Array<{
    kind: QueueChangeKind;
    queueItemId: string;
    from?: { targetSets?: number; targetReps?: number; sortOrder?: number };
    to?: { targetSets?: number; targetReps?: number; sortOrder?: number };
    reason: string;
  }>;
}
```

Accepting a recommendation calls the existing queue mutation path with `clientMutationId`. If the queue version changed since preview, service returns `RECOMMENDATION_QUEUE_MISMATCH` or `QUEUE_CONFLICT`; UI must request a new preview.

### 5.4 Source data assembly

```ts
interface CoachSourceData {
  localDate: string;
  todayWorkout: Pick<TodayWorkoutResponse, 'state' | 'routine' | 'hasHistory'>;
  checkIn: {
    mood: Metric<CheckInScale> | null;
    energy: Metric<CheckInScale> | null;
  };
  lastWorkoutFeedback: PostWorkoutFeedbackDto | null;
  lastSameRoutineWorkout: {
    workoutId: number;
    localDate: string;
    completedSets: number;
    discomfort: DiscomfortEntry[];
  } | null;
  historyWindow: {
    completedWorkoutsLast7Days: Metric<number>;
    completedWorkoutsThisWeek: Metric<number>;
  };
}
```

All fields are deterministic DB reads. No ML-derived “readiness” or “recovery” score.

### 5.5 Gemini structured output schema

Gemini response is accepted only if it validates; otherwise fallback is used.

```ts
const coachGeminiOutputSchema = z.object({
  reason: z.string().min(1).max(360),
  suggestedChanges: z.array(z.object({
    queueItemId: z.string().min(1),
    kind: z.enum(['remove_exercise', 'reduce_sets', 'reduce_reps', 'keep_exercise', 'reorder_exercise']),
    targetSets: z.number().int().min(1).max(10).optional(),
    targetReps: z.number().int().min(1).max(50).optional(),
    sortOrder: z.number().int().min(0).optional(),
    reason: z.string().min(1).max(180),
  })).min(1),
});
```

Validation hard rules after Zod:

- Every `queueItemId` must exist in current pending/held queue.
- No change may increase total volume in V1.
- At least one change must modify queue state/targets; preview cannot be no-op.
- Completed items are immutable.
- If all proposed changes are invalid, discard Gemini and use fallback.

### 5.6 Deterministic fallback rules

Fallback receives `SessionQueueSnapshot + CoachSourceData` and returns a non-empty `SessionQueueTransformation`.

Rules, in priority order:

1. **Energy low (`energy <= 2`):** keep the first compound-like item per major muscle group when possible; remove accessories/isolation after the first two pending exercises; reduce remaining pending target sets by 30% rounded down but never below 1. Reason: “Bajamos volumen porque registraste energía baja.”
2. **Energy medium (`energy === 3`) with discomfort from last feedback:** keep routine order; use the deterministic discomfort-to-muscle mapping below to reduce or remove pending items when a safe alternative remains; otherwise reduce sets by 30%. Reason references discomfort without diagnosis.
3. **Energy medium (`energy === 3`) without discomfort:** keep all exercises; reduce accessories by one set, never below 1.
4. **Energy high (`energy >= 4`) but last same-routine feedback effort high (`effort >= 8`) or sensation negative:** keep compounds; reduce accessories by one set. This avoids overclaiming recovery.
5. **No check-in / no history:** deterministic minimal adaptation still changes something: reduce the last pending accessory by one set if targetSets > 1; otherwise remove the last pending accessory; otherwise reduce last pending item reps by 20% rounded down, never below 1.
6. **Queue with one pending item:** reduce sets by 30% if `targetSets > 1`; else reduce reps by 20% if `targetReps > 1`; else mark the only pending item as `keep_exercise` with an explicit shortened rest/effort note only if the Track A queue supports such metadata. If the queue cannot represent any safe mutation for this edge, `GET /api/adaptive/today/workout` must expose `canAdapt: false` before the CTA is shown. Preview itself must not return a no-op.

Compound-like V1 heuristic is deterministic and local: an exercise is “accessory” if its `sortOrder >= 2` or its `muscleGroup` is a smaller group (`biceps`, `triceps`, `calves`, `abs`, `forearms`) when available. This is intentionally simple until exercise taxonomy improves.

Discomfort mapping V1 must normalize lowercase, trim accents, and map current free-form `muscleGroup` strings deterministically:

| Discomfort area | Muscle groups affected |
|---|---|
| `shoulder` | `hombros`, `pecho`, `espalda` |
| `elbow` | `biceps`, `triceps`, `pecho`, `espalda` |
| `wrist` | `biceps`, `triceps`, `forearms`, `antebrazos` |
| `back` | `espalda`, `piernas` |
| `hip` | `piernas`, `gluteos`, `glúteos` |
| `knee` | `piernas`, `cuadriceps`, `cuádriceps` |
| `ankle` | `piernas`, `calves`, `gemelos` |
| `neck`, `other` | no automatic removal; reduce sets only |

### 5.7 FE↔BE types

```ts
type CoachRecommendationStatus = 'pending' | 'accepted' | 'rejected';
type CoachEngine = 'deterministic' | 'gemini';

interface CoachSuggestedChangeDto {
  kind: QueueChangeKind;
  queueItemId: string;
  exerciseName: string;
  before: { targetSets: number; targetReps: number; sortOrder: number };
  after: { targetSets: number; targetReps: number; sortOrder: number } | null;
  reason: string;
}

interface CoachRecommendationDto {
  id: number;
  workoutId: number | null;
  routineId: number;
  localDate: string;
  original: SessionQueueSnapshot;
  adapted: SessionQueueSnapshot;
  reason: string;
  sourceData: CoachSourceData;
  suggestedChanges: CoachSuggestedChangeDto[];
  status: CoachRecommendationStatus;
  engine: CoachEngine;
  createdAt: string;
  acceptedAt: string | null;
  rejectedAt: string | null;
}

interface PreviewCoachRecommendationRequest {
  workoutId: number;
  clientMutationId: string;
}

interface DecideCoachRecommendationRequest {
  clientMutationId: string;
}
```

### 5.8 Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/api/adaptive/coach-recommendations/preview` | Sí | Persiste preview idempotente para un workout/queue actual |
| `POST` | `/api/adaptive/coach-recommendations/[id]/accept` | Sí | Aplica transformación sobre cola Skip/Hold |
| `POST` | `/api/adaptive/coach-recommendations/[id]/reject` | Sí | Marca rechazada; no toca cola |

Preview idempotency:

- Mismo `(user_id, client_mutation_id)` con mismo `workoutId` devuelve la recomendación existente.
- Mismo `(user_id, client_mutation_id)` con payload distinto devuelve `CONFLICT`.

Accept idempotency:

- Si ya está `accepted` y el `clientMutationId` coincide, devolver `200` con estado actual.
- Si ya está `rejected`, devolver `RECOMMENDATION_ALREADY_DECIDED`.
- Si cola cambió, devolver `RECOMMENDATION_QUEUE_MISMATCH` y no aplicar parcialmente.

## 6. PostWorkoutFeedback

### 6.1 Data model sketch

```ts
export const postWorkoutFeedback = sqliteTable(
  'post_workout_feedback',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull().references(() => users.id),
    workoutId: integer('workout_id').notNull().references(() => workouts.id),
    localDate: text('local_date').notNull(),
    effort: integer('effort').notNull(), // 1..10 user_input
    sensation: text('sensation').notNull(), // great|good|neutral|hard|bad
    discomfortJson: text('discomfort_json').notNull(), // [] if none
    note: text('note'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    uniqueWorkoutFeedback: uniqueIndex('post_workout_feedback_workout_id_unique').on(table.workoutId),
    userDateIdx: index('post_workout_feedback_user_local_date_idx').on(table.userId, table.localDate),
  }),
);

export type PostWorkoutFeedback = typeof postWorkoutFeedback.$inferSelect;
export type NewPostWorkoutFeedback = typeof postWorkoutFeedback.$inferInsert;
```

### 6.2 FE↔BE types

```ts
type WorkoutSensation = 'great' | 'good' | 'neutral' | 'hard' | 'bad';
type DiscomfortIntensity = 'mild' | 'moderate' | 'strong';

type DiscomfortArea =
  | 'neck'
  | 'shoulder'
  | 'elbow'
  | 'wrist'
  | 'back'
  | 'hip'
  | 'knee'
  | 'ankle'
  | 'other';

interface DiscomfortEntry {
  area: DiscomfortArea;
  intensity: DiscomfortIntensity;
}

interface PostWorkoutFeedbackRequest {
  effort: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  sensation: WorkoutSensation;
  discomfort: DiscomfortEntry[];
  note?: string | null;
}

interface PostWorkoutFeedbackDto {
  id: number;
  workoutId: number;
  localDate: string;
  effort: Metric<number>;
  sensation: Metric<WorkoutSensation>;
  discomfort: Metric<DiscomfortEntry[]>;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### 6.3 Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/adaptive/workouts/[id]/feedback` | Sí | Devuelve feedback o `null` |
| `PUT` | `/api/adaptive/workouts/[id]/feedback` | Sí | Upsert feedback para workout finalizado |

Reglas:

- `workoutId` debe pertenecer al usuario, no estar soft-deleted y tener `endedAt` no null.
- Un feedback por workout; upsert permite corregirlo.
- `discomfort` máximo 5 entries; `note` máximo 500 chars.
- Feed a siguiente recomendación: se toma el feedback más reciente del usuario y el feedback más reciente para la misma rutina, si existe. Esto es ensamblado determinístico de contexto, no ML.
- Copy: “Atlas usa tu último resultado para ajustar la propuesta.”

Errores:

- `POST_WORKOUT_FEEDBACK_ALREADY_EXISTS`: solo si se elige create-only. Recomendación: upsert.
- `VALIDATION`: workout abierto, esfuerzo fuera de rango, discomfort inválido.
- `NOT_FOUND`: workout inexistente/ajeno.

## 7. Progress básico

### 7.1 Boundary V1

V1 muestra consistencia semanal desde datos reales solamente. No inventa score de fitness, recuperación, calorías, readiness ni gráficos avanzados.

Fuentes existentes:

- `workouts.startedAt`, `workouts.endedAt`, `workouts.deletedAt`: días con entrenamiento real finalizado.
- `workout_sets.completed`, `workout_sets.deletedAt`: sets reales registrados.
- `daily_checkins.localDate`: actividad/check-in real si se decide mostrar “días con check-in”, separado de consistencia de entrenamiento.
- `user_streaks`: streak existente en Córdoba, pero el handoff prefiere consistencia semanal por encima de racha.

### 7.2 FE↔BE types

```ts
interface WeeklyConsistencyDayDto {
  localDate: string;
  planned: Metric<boolean>; // atlas_computed desde TrainingPlan
  completedWorkoutIds: Metric<number[]>; // atlas_computed desde workouts reales
  completed: Metric<boolean>;
}

interface WeeklyConsistencyResponse {
  weekStartsOn: string; // lunes Córdoba
  weekEndsOn: string;
  completedDays: Metric<number>;
  plannedTrainingDays: Metric<number>;
  consistencyRatio: Metric<{ completed: number; planned: number }>;
  days: WeeklyConsistencyDayDto[];
  emptyState: 'no_plan' | 'no_history' | null;
}
```

### 7.3 Endpoint

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/adaptive/progress/weekly-consistency` | Sí | Semana actual en Córdoba |

Reglas:

- Semana empieza lunes en Córdoba.
- `completed` cuenta días con al menos un `workouts` no borrado, `endedAt !== null`, cuya `endedAt` cae en ese `localDate` Córdoba. Si una sesión empieza antes de medianoche y termina después, cuenta por `endedAt`.
- `plannedTrainingDays` cuenta assignments del plan activo para esa semana, no workouts inventados.
- Si no hay plan: `emptyState = 'no_plan'`.
- Si hay plan pero no workouts finalizados históricos: `emptyState = 'no_history'`.

## 8. Empty states required by the handoff

These states are part of the API contract so FE tests do not depend on copy inference.

| State | Source endpoint/field | Required copy | CTA behavior | Test expectation |
|---|---|---|---|---|
| Sin plan | `GET /api/adaptive/today/workout` → `state: 'no_plan'` | `Todavía no tenés un plan.` | Show `Crear mi plan` and `Crear rutina manualmente`; hide `Empezar` and `Adaptar` | Córdoba today with no active plan returns `canStart: false`, `canAdapt: false`, `plan: null` |
| Sin historial | `GET /api/adaptive/today/workout` → `hasHistory: false`; progress endpoint → `emptyState: 'no_history'` | `Tu progreso empieza con tu primera sesión.` | Keep `Empezar entrenamiento` enabled when `state: 'ready'`; progress chart shows empty state | User with plan but no completed workouts gets real zero counts, not demo data |
| Sin check-in completo | `GET /api/adaptive/check-ins/today` → `checkIn: null` when no row or legacy mood-only row lacks `energy` | `¿Cómo estás hoy? Responder toma menos de 10 segundos.` | Show check-in CTA before Coach preview; `Empezar` can remain available if plan is ready | Legacy mood-only row does not invent energy; Coach sourceData has `energy: null` |
| IA indisponible | `POST /api/adaptive/coach-recommendations/preview` → `engine: 'deterministic'` | `Coach Atlas no está disponible temporalmente. Tu entrenamiento original sigue listo.` | Show preview generated by fallback plus `Empezar`; `Adaptar` remains useful because fallback changed the queue | Gemini unavailable/invalid JSON still returns `200`, persisted recommendation, and non-empty `suggestedChanges` |

## 9. NEW vs REUSED code map

| Entidad/flujo | Nuevo en V1 | Reutilizado |
|---|---|---|
| DailyCheckIn | `energy`, DTO con `Metric`, endpoints `/api/adaptive/check-ins/today` | Tabla/service `daily_checkins`, `cordobaLocalDate`, streak update si PO lo mantiene |
| TrainingPlan V1 | `training_plans`, `training_plan_assignments`, resolver today, start today endpoint | `User`, `Routine`, `routine_exercises`, ownership, `createWorkout`, soft delete patterns |
| Today workout hero | DTO `TodayWorkoutResponse`, empty states | `workouts`, `getActiveWorkout`, `DaySummary`, `RoutineSummary` |
| CoachRecommendation | Tabla audit, preview/accept/reject services, Zod output validation, fallback rules | Gemini adapter pattern, ADR-003 fallback philosophy, Skip/Hold queue, `clientMutationId` idempotency |
| PostWorkoutFeedback | Tabla + feedback endpoints + source data assembly | `WorkoutSession` as `workouts`, `workout_sets`, history services |
| Progress básico | Weekly consistency service/endpoint | `workouts`, `workout_sets`, `user_streaks`, Córdoba date helpers |
| Typed errors | Adaptive codes appended to union | `ApiError`, `AppError`, `handleApiError` |

## 10. Won't in V1

- Biometrics and wearables: Apple Health, Health Connect, HRV, RHR, sleep stages, steps auto-sync.
- Recovery/readiness score or “80% energy”. Energy is user input 1..5.
- ML learning, automatic progression, periodization, mesocycles, deloads.
- Advanced charts, volume by muscle group, fatigue model.
- Coach chat as product surface. Coach V1 is contextual recommendation + explainable action.
- Parallel queue/mutation mechanism outside Skip/Hold.

## 11. Resolved decisions (PO/Arch)

These questions were resolved by the PO with Architecture supervision. They govern implementation; the illustrative sketches above are superseded by §0 "As-built deltas" and by the shipped code where they diverge.

1. **Queue types** — Skip/Hold shipped (BE PR #30, FE PR #29). Queue type names are those in `lib/session/queue.ts` on `develop`; use them, not the `docs/engineering/session-skip-hold.md` draft names.
2. **DailyCheckIn = upsert.** Single service `recordDailyCheckIn` upserts by `(userId, localDate)` in Córdoba time. `energy` and `note` are optional/nullable (DATA HONESTY: store `NULL` when not provided, never a fabricated default). No `CHECKIN_ALREADY_EXISTS`.
3. **Empty TrainingPlan is rejected** with `VALIDATION` ("El plan debe tener al menos un día asignado"). A plan needs ≥1 day assignment; there is no implicit "all rest days" plan.
4. **Double session** is an explicit secondary action after `completed_today`, not a primary CTA. `POST /start` only creates on `ready`, or on `completed_today` with an explicit `allowDoubleSession` flag.
5. **`dayOfWeek` is 0..6, 0=Sunday..6=Saturday (JS `Date.getDay()`).** This is the shipped convention (PR #38, table `scheduled_routines`). It is always computed server-side in Córdoba (`lib/time/cordoba.ts`), never from the client, so the `getDay()` ambiguity is avoided by construction. The earlier ISO 1..7 proposal is NOT used.
6. **Discomfort taxonomy** is sufficient for V1 and is presented as self-reported context for adaptation, never as medical advice.
7. **`post_workout_feedback` is optional** — an after-close prompt, never required to close a workout.
8. **Mood/check-in updates `user_streaks`.** The consolidated `recordDailyCheckIn` calls `updateStreakFromActivity`, preserving the prior mood-based streak behavior (no regression).
9. **Coach preview may run from the routine before a workout exists.** Preview does not require an already-created workout/queue; `POST /workouts` creating the active session is a separate, later step. The recommendation is persisted (PR #41) and its acceptance is explicit and traceable.
