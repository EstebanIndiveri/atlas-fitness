/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, it } from '@jest/globals';
import { and, eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import { DELETE, PUT } from './route';
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
const ENDED = new Date('2026-09-17T02:00:00.000Z');

const CREATE_TOKEN = { expectedNoteId: null, expectedVersion: null } as const;

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
}): Promise<number> {
  const [row] = await db
    .insert(workouts)
    .values({
      userId: overrides.userId,
      routineId: overrides.routineId ?? null,
      startedAt: AFTERNOON,
      endedAt: overrides.endedAt ?? null,
    })
    .returning({ id: workouts.id });
  return row!.id;
}

async function createSet(workoutId: number, exerciseId: number): Promise<void> {
  await db.insert(workoutSets).values({
    workoutId,
    exerciseId,
    setIndex: 1,
    reps: 8,
    weightKg: '60',
  });
}

async function noteRow(workoutId: number, exerciseId: number) {
  const [row] = await db
    .select()
    .from(workoutExerciseNotes)
    .where(
      and(
        eq(workoutExerciseNotes.workoutId, workoutId),
        eq(workoutExerciseNotes.exerciseId, exerciseId),
      ),
    );
  return row;
}

function noteUrl(workoutId: number | string, exerciseId: number | string): string {
  return `http://localhost:3000/api/workouts/${workoutId}/exercises/${exerciseId}/note`;
}

interface RouteContext {
  params: Promise<{ id: string; exerciseId: string }>;
}

function routeContext(workoutId: number | string, exerciseId: number | string): RouteContext {
  return { params: Promise.resolve({ id: String(workoutId), exerciseId: String(exerciseId) }) };
}

async function authenticatedRequest(
  userId: number,
  url: string,
  method: string,
  rawBody?: string,
): Promise<NextRequest> {
  const cookie = await issueSessionCookieHeader(userId);
  return new NextRequest(url, {
    method,
    headers: { cookie, 'content-type': 'application/json' },
    body: rawBody,
  });
}

async function putNote(
  userId: number,
  workoutId: number | string,
  exerciseId: number | string,
  body: unknown,
) {
  const request = await authenticatedRequest(
    userId,
    noteUrl(workoutId, exerciseId),
    'PUT',
    JSON.stringify(body),
  );
  return PUT(request, routeContext(workoutId, exerciseId));
}

async function deleteNote(
  userId: number,
  workoutId: number | string,
  exerciseId: number | string,
  body: unknown,
) {
  const request = await authenticatedRequest(
    userId,
    noteUrl(workoutId, exerciseId),
    'DELETE',
    JSON.stringify(body),
  );
  return DELETE(request, routeContext(workoutId, exerciseId));
}

describe('/api/workouts/[id]/exercises/[exerciseId]/note', () => {
  let userId: number;
  let otherUserId: number;
  let exerciseId: number;
  let routineId: number;
  let workoutId: number;

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

    userId = await createUser('note-owner@example.com');
    otherUserId = await createUser('note-intruder@example.com');
    exerciseId = await createExercise({ slug: 'bench', isSystem: true });
    routineId = await createRoutine(userId, [exerciseId]);
    workoutId = await createWorkout({ userId, routineId });
  });

  it('PUT creates a note and returns HTTP 201 with the persisted row', async () => {
    const response = await putNote(userId, workoutId, exerciseId, {
      note: '  recordar subir  ',
      ...CREATE_TOKEN,
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: expect.any(Number),
      userId,
      workoutId,
      exerciseId,
      note: 'recordar subir',
      version: 1,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });

    const row = await noteRow(workoutId, exerciseId);
    expect(row).toMatchObject({ userId, note: 'recordar subir', version: 1 });
  });

  it('PUT updates an existing note with the exact token and returns HTTP 200', async () => {
    const created = await (
      await putNote(userId, workoutId, exerciseId, { note: 'recordar', ...CREATE_TOKEN })
    ).json();
    const createdRow = created as { id: number };

    const response = await putNote(userId, workoutId, exerciseId, {
      note: 'subir 5kg',
      expectedNoteId: createdRow.id,
      expectedVersion: 1,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: createdRow.id,
      note: 'subir 5kg',
      version: 2,
    });
    await expect(noteRow(workoutId, exerciseId)).resolves.toMatchObject({
      id: createdRow.id,
      note: 'subir 5kg',
      version: 2,
    });
  });

  it('PUT treats a repeated create with the same normalized text as idempotent HTTP 200', async () => {
    await putNote(userId, workoutId, exerciseId, { note: 'recordar', ...CREATE_TOKEN });

    const response = await putNote(userId, workoutId, exerciseId, {
      note: '  recordar  ',
      ...CREATE_TOKEN,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ note: 'recordar', version: 1 });
    await expect(noteRow(workoutId, exerciseId)).resolves.toMatchObject({ version: 1 });
  });

  it('PUT returns 409 CONFLICT for a different text with null expectations', async () => {
    await putNote(userId, workoutId, exerciseId, { note: 'recordar', ...CREATE_TOKEN });

    const response = await putNote(userId, workoutId, exerciseId, {
      note: 'otra cosa',
      ...CREATE_TOKEN,
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'CONFLICT' });
    await expect(noteRow(workoutId, exerciseId)).resolves.toMatchObject({ note: 'recordar' });
  });

  it('PUT treats an identical text with a stale version as an idempotent HTTP 200', async () => {
    const created = await (
      await putNote(userId, workoutId, exerciseId, { note: 'recordar', ...CREATE_TOKEN })
    ).json();
    const createdRow = created as { id: number };
    await putNote(userId, workoutId, exerciseId, {
      note: 'subir 5kg',
      expectedNoteId: createdRow.id,
      expectedVersion: 1,
    });

    const response = await putNote(userId, workoutId, exerciseId, {
      note: 'subir 5kg',
      expectedNoteId: createdRow.id,
      expectedVersion: 1,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: createdRow.id,
      note: 'subir 5kg',
      version: 2,
    });
  });

  it('PUT returns 409 CONFLICT for a different text with a stale version', async () => {
    const created = await (
      await putNote(userId, workoutId, exerciseId, { note: 'recordar', ...CREATE_TOKEN })
    ).json();
    const createdRow = created as { id: number };
    await putNote(userId, workoutId, exerciseId, {
      note: 'subir 5kg',
      expectedNoteId: createdRow.id,
      expectedVersion: 1,
    });

    const response = await putNote(userId, workoutId, exerciseId, {
      note: 'otra cosa',
      expectedNoteId: createdRow.id,
      expectedVersion: 1,
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'CONFLICT' });
  });

  it('PUT returns 400 VALIDATION for a finished workout without writing', async () => {
    const endedWorkoutId = await createWorkout({ userId, routineId, endedAt: ENDED });

    const response = await putNote(userId, endedWorkoutId, exerciseId, {
      note: 'recordar',
      ...CREATE_TOKEN,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'VALIDATION',
      message: 'No puedes modificar la nota de un entrenamiento finalizado.',
    });
    expect(await noteRow(endedWorkoutId, exerciseId)).toBeUndefined();
  });

  it('PUT ignores userId and workoutId supplied in the body', async () => {
    const foreignWorkoutId = await createWorkout({ userId: otherUserId, routineId: null });
    await createSet(foreignWorkoutId, exerciseId);

    const response = await putNote(userId, workoutId, exerciseId, {
      note: 'recordar',
      userId: otherUserId,
      workoutId: foreignWorkoutId,
      exerciseId: 999,
      ...CREATE_TOKEN,
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ userId, workoutId, exerciseId });
    expect(await noteRow(foreignWorkoutId, exerciseId)).toBeUndefined();
  });

  it('PUT returns 400 VALIDATION for a malformed JSON body', async () => {
    const request = await authenticatedRequest(
      userId,
      noteUrl(workoutId, exerciseId),
      'PUT',
      'not-json',
    );

    const response = await PUT(request, routeContext(workoutId, exerciseId));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'VALIDATION',
      message: 'Body JSON inválido',
    });
  });

  it('PUT returns 400 VALIDATION for an invalid note body', async () => {
    const response = await putNote(userId, workoutId, exerciseId, { expectedNoteId: 1 });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION' });
  });

  it('PUT returns 400 VALIDATION for a non-numeric workout id', async () => {
    const response = await putNote(userId, '12abc', exerciseId, { note: 'x', ...CREATE_TOKEN });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'VALIDATION',
      message: 'ID de entrenamiento inválido',
    });
  });

  it('PUT returns 400 VALIDATION for a non-numeric exercise id', async () => {
    const response = await putNote(userId, workoutId, '9x', { note: 'x', ...CREATE_TOKEN });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'VALIDATION',
      message: 'ID de ejercicio inválido',
    });
  });

  it('PUT returns 403 FORBIDDEN for a workout owned by another user', async () => {
    const foreignWorkoutId = await createWorkout({ userId: otherUserId, routineId: null });
    await createSet(foreignWorkoutId, exerciseId);

    const response = await putNote(userId, foreignWorkoutId, exerciseId, {
      note: 'recordar',
      ...CREATE_TOKEN,
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: 'FORBIDDEN',
      message: 'No tienes permiso para acceder a este entrenamiento',
    });
  });

  it('PUT returns 404 NOT_FOUND for an exercise owned by another user', async () => {
    const privateExerciseId = await createExercise({
      slug: 'private-press',
      isSystem: false,
      userId: otherUserId,
    });
    await createRoutine(userId, [privateExerciseId]);

    const response = await putNote(userId, workoutId, privateExerciseId, {
      note: 'recordar',
      ...CREATE_TOKEN,
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: 'NOT_FOUND',
      message: 'Ejercicio no encontrado',
    });
  });

  it('PUT returns 404 NOT_FOUND for an exercise unrelated to the workout', async () => {
    const unrelatedExerciseId = await createExercise({ slug: 'squat', isSystem: true });

    const response = await putNote(userId, workoutId, unrelatedExerciseId, {
      note: 'recordar',
      ...CREATE_TOKEN,
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: 'NOT_FOUND',
      message: 'Ejercicio no encontrado',
    });
  });

  it('DELETE removes the exact note and returns 200 {note:null}', async () => {
    const created = await (
      await putNote(userId, workoutId, exerciseId, { note: 'recordar', ...CREATE_TOKEN })
    ).json();
    const createdRow = created as { id: number };

    const response = await deleteNote(userId, workoutId, exerciseId, {
      expectedNoteId: createdRow.id,
      expectedVersion: 1,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ note: null });
    expect(await noteRow(workoutId, exerciseId)).toBeUndefined();
  });

  it('DELETE is idempotent when no note exists', async () => {
    const response = await deleteNote(userId, workoutId, exerciseId, {
      expectedNoteId: 999,
      expectedVersion: 1,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ note: null });
  });

  it('DELETE returns 409 CONFLICT when a different note still exists', async () => {
    const created = await (
      await putNote(userId, workoutId, exerciseId, { note: 'recordar', ...CREATE_TOKEN })
    ).json();
    const createdRow = created as { id: number };

    const response = await deleteNote(userId, workoutId, exerciseId, {
      expectedNoteId: createdRow.id + 1000,
      expectedVersion: 1,
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'CONFLICT' });
    await expect(noteRow(workoutId, exerciseId)).resolves.toMatchObject({ note: 'recordar' });
  });

  it('DELETE returns 400 VALIDATION for a finished workout', async () => {
    const endedWorkoutId = await createWorkout({ userId, routineId, endedAt: ENDED });

    const response = await deleteNote(userId, endedWorkoutId, exerciseId, {
      expectedNoteId: 1,
      expectedVersion: 1,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'VALIDATION',
      message: 'No puedes modificar la nota de un entrenamiento finalizado.',
    });
  });

  it('DELETE returns 400 VALIDATION for an invalid token body', async () => {
    const response = await deleteNote(userId, workoutId, exerciseId, {});

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION' });
  });

  it('DELETE returns 400 VALIDATION for a malformed JSON body', async () => {
    const request = await authenticatedRequest(
      userId,
      noteUrl(workoutId, exerciseId),
      'DELETE',
      'not-json',
    );

    const response = await DELETE(request, routeContext(workoutId, exerciseId));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'VALIDATION',
      message: 'Body JSON inválido',
    });
  });

  it('DELETE returns 403 FORBIDDEN for a workout owned by another user', async () => {
    const foreignWorkoutId = await createWorkout({ userId: otherUserId, routineId: null });
    await createSet(foreignWorkoutId, exerciseId);

    const response = await deleteNote(userId, foreignWorkoutId, exerciseId, {
      expectedNoteId: 1,
      expectedVersion: 1,
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: 'FORBIDDEN',
      message: 'No tienes permiso para acceder a este entrenamiento',
    });
  });

  it('returns 401 UNAUTHORIZED without a session', async () => {
    const request = new NextRequest(noteUrl(workoutId, exerciseId), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ note: 'recordar', ...CREATE_TOKEN }),
    });

    const response = await PUT(request, routeContext(workoutId, exerciseId));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
