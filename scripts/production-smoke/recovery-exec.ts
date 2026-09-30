import { deleteWorkoutWithReadback } from './cleanup';
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
  if (response.status !== 200) {
    throw new Error(`GET /api/workouts returned ${response.status}`);
  }
  return asArray(requireJson(response, 'workouts'), 'workouts').map((row) =>
    parseWorkout(row, 'workout').id,
  );
}

async function readWorkoutDetail(
  client: SmokeHttpClient,
  workoutId: number,
): Promise<Record<string, unknown> | null> {
  const response = await client.get(`/api/workouts/${workoutId}`);
  if (response.status === 404) {
    return null;
  }
  if (response.status !== 200) {
    throw new Error(`GET /api/workouts/${workoutId} returned ${response.status}`);
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
  if (response.status !== 200) {
    return [];
  }
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

/** Deletes any current note on an active orphan so the marker is removed first. */
async function deleteActiveNotes(
  client: SmokeHttpClient,
  workoutId: number,
  exerciseIds: readonly number[],
): Promise<void> {
  for (const exerciseId of exerciseIds) {
    const response = await client.get(`/api/workouts/${workoutId}/exercises/${exerciseId}/context`);
    if (response.status === 404) {
      continue;
    }
    if (response.status !== 200) {
      throw new Error(`Context read returned ${response.status} for workout ${workoutId}`);
    }
    const context = parseExerciseContext(
      requireJson(response, 'context'),
      `context-${workoutId}-${exerciseId}`,
    );
    if (!context.currentNote) {
      continue;
    }
    const remove = await client.del(`/api/workouts/${workoutId}/exercises/${exerciseId}/note`, {
      body: {
        expectedNoteId: context.currentNote.id,
        expectedVersion: context.currentNote.version,
      },
    });
    if (remove.status !== 200) {
      throw new Error(`Note delete returned ${remove.status} for workout ${workoutId}`);
    }
  }
}

export interface RecoveryParams {
  expectedUserId: number;
  now: Date;
  crashWindowMs: number;
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
  if (listResponse.status !== 200) {
    throw new Error(`GET /api/workouts returned ${listResponse.status}`);
  }
  const rows = asArray(requireJson(listResponse, 'workouts'), 'workouts').map((row) =>
    parseWorkout(row, 'workout'),
  );

  const activeResponse = await client.get('/api/workouts/active');
  if (activeResponse.status !== 200) {
    throw new Error(`GET /api/workouts/active returned ${activeResponse.status}`);
  }
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
      deleteWorkout: async () =>
        (await client.del(`/api/workouts/${cleanup.workoutId}`)).status,
      listWorkoutIds: () => listVisibleWorkoutIds(client),
    });
    recovered += 1;
  }

  return recovered;
}
