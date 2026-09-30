/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, it } from '@jest/globals';
import { NextRequest } from 'next/server';

import { GET } from './route';
import { issueSessionCookieHeader } from '@/lib/auth/session-store';
import { db } from '@/lib/db/client';
import {
  coachRecommendations,
  exercises,
  habitLogs,
  postWorkoutFeedback,
  routineExercises,
  routines,
  scheduledRoutines,
  sessions,
  trainingPlans,
  users,
  workoutExerciseNotes,
  workoutQueueMutations,
  workouts,
  workoutSets,
} from '@/lib/db/schema';

const AFTERNOON = new Date('2026-09-17T18:00:00.000Z');
// 2026-09-17T02:00:00Z is 2026-09-16 23:00 in Córdoba (UTC−3).
const SETS_ENDED = new Date('2026-09-17T02:00:00.000Z');
// 2026-09-15T02:00:00Z is 2026-09-14 23:00 in Córdoba (UTC−3).
const NOTE_ENDED = new Date('2026-09-15T02:00:00.000Z');

async function createUser(email: string): Promise<number> {
  const [row] = await db
    .insert(users)
    .values({ name: email, email, passwordHash: 'hash' })
    .returning({ id: users.id });
  return row!.id;
}

async function createExercise(overrides: {
  slug: string;
  isSystem: boolean;
  userId?: number | null;
}): Promise<number> {
  const [row] = await db
    .insert(exercises)
    .values({
      slug: overrides.slug,
      name: overrides.slug,
      muscleGroup: 'Pecho',
      instructions: 'x',
      isSystem: overrides.isSystem,
      userId: overrides.userId ?? null,
    })
    .returning({ id: exercises.id });
  return row!.id;
}

async function createRoutine(userId: number, exerciseIds: readonly number[]): Promise<number> {
  const [routine] = await db
    .insert(routines)
    .values({ slug: `routine-${Math.random().toString(36).slice(2)}`, name: 'Rutina', isSystem: false, userId })
    .returning({ id: routines.id });
  let order = 1;
  for (const exerciseId of exerciseIds) {
    await db.insert(routineExercises).values({
      routineId: routine!.id,
      exerciseId,
      sortOrder: order,
      targetSets: 3,
      targetReps: 10,
    });
    order += 1;
  }
  return routine!.id;
}

async function createWorkout(overrides: {
  userId: number;
  routineId?: number | null;
  endedAt?: Date | null;
  startedAt?: Date;
}): Promise<number> {
  const [row] = await db
    .insert(workouts)
    .values({
      userId: overrides.userId,
      routineId: overrides.routineId ?? null,
      startedAt: overrides.startedAt ?? AFTERNOON,
      endedAt: overrides.endedAt ?? null,
    })
    .returning({ id: workouts.id });
  return row!.id;
}

async function createSet(overrides: {
  workoutId: number;
  exerciseId: number;
  setIndex: number;
  reps?: number;
  weightKg?: string;
  completed?: boolean;
}): Promise<number> {
  const [row] = await db
    .insert(workoutSets)
    .values({
      workoutId: overrides.workoutId,
      exerciseId: overrides.exerciseId,
      setIndex: overrides.setIndex,
      reps: overrides.reps ?? 8,
      weightKg: overrides.weightKg ?? '60',
      completed: overrides.completed ?? true,
    })
    .returning({ id: workoutSets.id });
  return row!.id;
}

async function createNoteRow(overrides: {
  userId: number;
  workoutId: number;
  exerciseId: number;
  note: string;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}): Promise<number> {
  const at = overrides.createdAt ?? new Date('2026-09-18T12:00:00.000Z');
  const [row] = await db
    .insert(workoutExerciseNotes)
    .values({
      userId: overrides.userId,
      workoutId: overrides.workoutId,
      exerciseId: overrides.exerciseId,
      note: overrides.note,
      version: overrides.version ?? 1,
      createdAt: at,
      updatedAt: overrides.updatedAt ?? at,
    })
    .returning({ id: workoutExerciseNotes.id });
  return row!.id;
}

function contextUrl(workoutId: number | string, exerciseId: number | string): string {
  return `http://localhost:3000/api/workouts/${workoutId}/exercises/${exerciseId}/context`;
}

async function getContext(
  userId: number,
  workoutId: number | string,
  exerciseId: number | string,
) {
  const cookie = await issueSessionCookieHeader(userId);
  const request = new NextRequest(contextUrl(workoutId, exerciseId), {
    method: 'GET',
    headers: { cookie },
  });
  return GET(request, {
    params: Promise.resolve({ id: String(workoutId), exerciseId: String(exerciseId) }),
  });
}

describe('GET /api/workouts/[id]/exercises/[exerciseId]/context', () => {
  let userId: number;
  let otherUserId: number;
  let exerciseId: number;

  beforeEach(async () => {
    await db.delete(workoutExerciseNotes);
    await db.delete(workoutQueueMutations);
    await db.delete(postWorkoutFeedback);
    await db.delete(coachRecommendations);
    await db.delete(scheduledRoutines);
    await db.delete(workoutSets);
    await db.delete(routineExercises);
    await db.delete(workouts);
    await db.delete(routines);
    await db.delete(trainingPlans);
    await db.delete(habitLogs);
    await db.delete(sessions);
    await db.delete(exercises);
    await db.delete(users);

    userId = await createUser('context-owner@example.com');
    otherUserId = await createUser('context-intruder@example.com');
    exerciseId = await createExercise({ slug: 'bench', isSystem: true });
  });

  it('returns the exact bounded context with independent set/note sources', async () => {
    const routineId = await createRoutine(userId, [exerciseId]);
    const currentWorkoutId = await createWorkout({ userId, routineId });
    const setsWorkoutId = await createWorkout({
      userId,
      startedAt: SETS_ENDED,
      endedAt: SETS_ENDED,
    });
    const noteWorkoutId = await createWorkout({
      userId,
      startedAt: NOTE_ENDED,
      endedAt: NOTE_ENDED,
    });

    // Insert out of order to prove the response orders by setIndex.
    const secondSetId = await createSet({ workoutId: setsWorkoutId, exerciseId, setIndex: 2, reps: 6, weightKg: '70' });
    const firstSetId = await createSet({ workoutId: setsWorkoutId, exerciseId, setIndex: 1, reps: 8, weightKg: '62.75' });
    const historyNoteId = await createNoteRow({
      userId,
      workoutId: noteWorkoutId,
      exerciseId,
      note: 'bajar volumen',
    });
    const currentNoteId = await createNoteRow({
      userId,
      workoutId: currentWorkoutId,
      exerciseId,
      note: 'recordar subir',
      version: 2,
    });

    const response = await getContext(userId, currentWorkoutId, exerciseId);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      workoutId: currentWorkoutId,
      exerciseId,
      currentNote: {
        id: currentNoteId,
        userId,
        workoutId: currentWorkoutId,
        exerciseId,
        note: 'recordar subir',
        version: 2,
        createdAt: '2026-09-18T12:00:00.000Z',
        updatedAt: '2026-09-18T12:00:00.000Z',
      },
      lastCompletedSets: {
        workoutId: setsWorkoutId,
        exerciseId,
        localDate: '2026-09-16',
        endedAt: '2026-09-17T02:00:00.000Z',
        sets: [
          { id: firstSetId, exerciseId, setIndex: 1, reps: 8, weightKg: '62.75' },
          { id: secondSetId, exerciseId, setIndex: 2, reps: 6, weightKg: '70' },
        ],
      },
      lastCompletedNote: {
        workoutId: noteWorkoutId,
        exerciseId,
        localDate: '2026-09-14',
        endedAt: '2026-09-15T02:00:00.000Z',
        noteId: historyNoteId,
        note: 'bajar volumen',
        version: 1,
      },
    });
  });

  it('returns null sources when there is no current note or history', async () => {
    const routineId = await createRoutine(userId, [exerciseId]);
    const workoutId = await createWorkout({ userId, routineId });

    const response = await getContext(userId, workoutId, exerciseId);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      workoutId,
      exerciseId,
      currentNote: null,
      lastCompletedSets: null,
      lastCompletedNote: null,
    });
  });

  it('never reports the current open workout as lastCompleted', async () => {
    const routineId = await createRoutine(userId, [exerciseId]);
    const workoutId = await createWorkout({ userId, routineId });
    await createSet({ workoutId, exerciseId, setIndex: 1, reps: 8, weightKg: '60' });
    await createNoteRow({ userId, workoutId, exerciseId, note: 'nota actual' });

    const response = await getContext(userId, workoutId, exerciseId);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      currentNote: { note: 'nota actual' },
      lastCompletedSets: null,
      lastCompletedNote: null,
    });
  });

  it('is side-effect free across repeated reads', async () => {
    const routineId = await createRoutine(userId, [exerciseId]);
    const workoutId = await createWorkout({ userId, routineId });

    const before = await db.select().from(workoutExerciseNotes);
    const first = await getContext(userId, workoutId, exerciseId);
    const second = await getContext(userId, workoutId, exerciseId);
    const after = await db.select().from(workoutExerciseNotes);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    await expect(first.json()).resolves.toEqual(await second.json());
    expect(after).toEqual(before);
  });

  it('returns 401 UNAUTHORIZED without a session', async () => {
    const response = await GET(
      new NextRequest(contextUrl(1, exerciseId), { method: 'GET' }),
      { params: Promise.resolve({ id: '1', exerciseId: String(exerciseId) }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('returns 400 VALIDATION for a non-numeric workout id', async () => {
    const response = await getContext(userId, '12abc', exerciseId);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'VALIDATION',
      message: 'ID de entrenamiento inválido',
    });
  });

  it('returns 400 VALIDATION for a non-numeric exercise id', async () => {
    const response = await getContext(userId, 1, '9x');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'VALIDATION',
      message: 'ID de ejercicio inválido',
    });
  });

  it('returns 403 FORBIDDEN for a workout owned by another user', async () => {
    const otherRoutineId = await createRoutine(otherUserId, [exerciseId]);
    const foreignWorkoutId = await createWorkout({ userId: otherUserId, routineId: otherRoutineId });

    const response = await getContext(userId, foreignWorkoutId, exerciseId);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: 'FORBIDDEN',
      message: 'No tienes permiso para acceder a este entrenamiento',
    });
  });

  it('returns 404 NOT_FOUND for an exercise owned by another user', async () => {
    const privateExerciseId = await createExercise({
      slug: 'private-press',
      isSystem: false,
      userId: otherUserId,
    });
    const routineId = await createRoutine(userId, [privateExerciseId]);
    const workoutId = await createWorkout({ userId, routineId });

    const response = await getContext(userId, workoutId, privateExerciseId);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: 'NOT_FOUND',
      message: 'Ejercicio no encontrado',
    });
  });

  it('returns 404 NOT_FOUND for an exercise unrelated to the workout', async () => {
    const unrelatedExerciseId = await createExercise({ slug: 'squat', isSystem: true });
    const routineId = await createRoutine(userId, [exerciseId]);
    const workoutId = await createWorkout({ userId, routineId });

    const response = await getContext(userId, workoutId, unrelatedExerciseId);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: 'NOT_FOUND',
      message: 'Ejercicio no encontrado',
    });
  });
});
