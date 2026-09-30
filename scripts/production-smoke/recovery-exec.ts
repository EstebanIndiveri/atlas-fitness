import { deleteNoteWithReadback, deleteWorkoutWithReadback } from './cleanup';
import { requireHttpStatus } from './http-status';
import type { SmokeHttpClient } from './http-client';
import {
  asArray,
  asNumber,
  asRecord,
  parseExerciseContext,
  parseWorkout,
  requireJson,
} from './api-ops';
import { classifyOrphans, type OrphanProbe, type RecoveryAmbiguity } from './recovery';

/** Raised when orphan preflight finds an artifact it must not guess about. */
export class AmbiguousOrphansError extends Error {
  constructor(readonly reasons: readonly RecoveryAmbiguity[]) {
    super('Ambiguous QA artifacts found; refusing to delete');
    this.name = 'AmbiguousOrphansError';
  }
}

/** Lists the visible (non-deleted, owned) workout ids. */
export async function listVisibleWorkoutIds(client: SmokeHttpClient): Promise<number[]> {
  const response = await client.get('/api/workouts');
  requireHttpStatus(response, [200], 'cleanup', 'list_workouts');
  return asArray(requireJson(response, 'workouts'), 'workouts').map((row) =>
    parseWorkout(row, 'workout').id,
  );
}

/** Reads a workout detail (or `null` for 404). */
export async function readWorkoutDetail(
  client: SmokeHttpClient,
  workoutId: number,
): Promise<Record<string, unknown> | null> {
  const response = await client.get(`/api/workouts/${workoutId}`);
  requireHttpStatus(response, [200, 404], 'cleanup', `workout_${workoutId}`);
  if (response.status === 404) {
    return null;
  }
  return asRecord(requireJson(response, `workout-${workoutId}`), `workout-${workoutId}`);
}

function collectSetExerciseIds(detail: Record<string, unknown> | null): number[] {
  if (!detail || !Array.isArray(detail.sets)) {
    return [];
  }
  const ids = new Set<number>();
  for (const set of detail.sets) {
    const record = asRecord(set, 'set');
    const exerciseId = record.exerciseId;
    if (typeof exerciseId === 'number' && Number.isInteger(exerciseId) && exerciseId > 0) {
      ids.add(exerciseId);
    }
  }
  return Array.from(ids);
}

async function collectRoutineExerciseIds(
  client: SmokeHttpClient,
  routineId: number | null,
): Promise<number[]> {
  if (routineId === null) {
    return [];
  }
  const response = await client.get('/api/routines');
  requireHttpStatus(response, [200], 'cleanup', 'routines');
  const routines = asArray(requireJson(response, 'routines'), 'routines');
  for (const item of routines) {
    const routine = asRecord(item, 'routine');
    if (asNumber(routine, 'id', 'routine') !== routineId) {
      continue;
    }
    return asArray(routine.exercises, 'routine.exercises')
      .map((exercise) => asRecord(exercise, 'routineExercise'))
      .map((exercise) => exercise.exerciseId)
      .filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0);
  }
  return [];
}

function unique(ids: readonly number[]): number[] {
  return Array.from(new Set(ids));
}

/** Deletes any current note on an active orphan with a `currentNote:null` readback. */
async function deleteActiveNotes(
  client: SmokeHttpClient,
  workoutId: number,
  exerciseIds: readonly number[],
): Promise<void> {
  for (const exerciseId of exerciseIds) {
    const readResponse = await client.get(
      `/api/workouts/${workoutId}/exercises/${exerciseId}/context`,
    );
    if (readResponse.status === 404) {
      continue;
    }
    requireHttpStatus(readResponse, [200], 'cleanup', `context_${workoutId}_${exerciseId}`);
    const context = parseExerciseContext(
      requireJson(readResponse, 'context'),
      `context-${workoutId}-${exerciseId}`,
    );
    if (!context.currentNote) {
      continue;
    }
    const noteId = context.currentNote.id;
    const version = context.currentNote.version;
    await deleteNoteWithReadback({
      deleteNote: () =>
        client.del(`/api/workouts/${workoutId}/exercises/${exerciseId}/note`, {
          body: { expectedNoteId: noteId, expectedVersion: version },
        }),
      readContext: () =>
        client.get(`/api/workouts/${workoutId}/exercises/${exerciseId}/context`),
    });
  }
}

export interface RecoveryParams {
  expectedUserId: number;
  /** System routine expected for a create-before-mark orphan (`null` = cannot verify). */
  expectedRoutineId: number | null;
  now: Date;
  crashWindowMs: number;
  /** Ids recorded in a secret-free manifest, trusted for stale reconciliation. */
  trustedWorkoutIds?: readonly number[];
}

/**
 * Preflight/recovery for prior QA artifacts (architecture §6).
 *
 * Never guesses: ambiguity stops the run before any deletion. Repeats are safe
 * because a 404 delete is accepted only after a readback confirms absence.
 *
 * @returns The number of artifacts cleaned.
 */
export async function recoverOrphans(
  client: SmokeHttpClient,
  params: RecoveryParams,
): Promise<number> {
  const listResponse = await client.get('/api/workouts');
  requireHttpStatus(listResponse, [200], 'cleanup', 'list_workouts');
  const rows = asArray(requireJson(listResponse, 'workouts'), 'workouts').map((row) =>
    parseWorkout(row, 'workout'),
  );

  const activeResponse = await client.get('/api/workouts/active');
  requireHttpStatus(activeResponse, [200], 'cleanup', 'active_workout');
  const activeBody = requireJson(activeResponse, 'active');
  const activeWorkout =
    activeBody === null || activeBody === undefined ? null : parseWorkout(activeBody, 'active');

  const probes: OrphanProbe[] = [];
  for (const workout of rows) {
    let hasSets = false;
    if (
      workout.endedAt === null &&
      activeWorkout !== null &&
      workout.id === activeWorkout.id &&
      workout.note === null
    ) {
      const detail = await readWorkoutDetail(client, workout.id);
      hasSets = collectSetExerciseIds(detail).length > 0;
    }
    probes.push({
      id: workout.id,
      userId: workout.userId,
      note: workout.note,
      routineId: workout.routineId,
      startedAt: workout.startedAt,
      endedAt: workout.endedAt,
      hasSets,
    });
  }

  const plan = classifyOrphans({
    probes,
    activeWorkoutId: activeWorkout?.id ?? null,
    expectedUserId: params.expectedUserId,
    expectedRoutineId: params.expectedRoutineId,
    trustedWorkoutIds: params.trustedWorkoutIds ?? [],
    now: params.now,
    crashWindowMs: params.crashWindowMs,
  });

  if (plan.ambiguous.length > 0) {
    throw new AmbiguousOrphansError(plan.ambiguous);
  }

  let recovered = 0;
  for (const cleanup of plan.cleanups) {
    const workout = rows.find((row) => row.id === cleanup.workoutId);
    if (cleanup.deleteNote) {
      const detail = await readWorkoutDetail(client, cleanup.workoutId);
      const candidates = unique([
        ...collectSetExerciseIds(detail),
        ...(await collectRoutineExerciseIds(client, workout?.routineId ?? null)),
      ]);
      await deleteActiveNotes(client, cleanup.workoutId, candidates);
    }

    await deleteWorkoutWithReadback({
      workoutId: cleanup.workoutId,
      deleteWorkout: () => client.del(`/api/workouts/${cleanup.workoutId}`),
      listWorkoutIds: () => listVisibleWorkoutIds(client),
    });
    recovered += 1;
  }

  return recovered;
}
