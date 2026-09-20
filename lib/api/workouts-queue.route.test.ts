/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST as skipWorkout } from '@/app/api/workouts/[id]/skip/route';
import { POST as holdWorkout } from '@/app/api/workouts/[id]/hold/route';
import { GET as getWorkout } from '@/app/api/workouts/[id]/route';
import { issueSessionCookieHeader } from '@/lib/auth/session-store';
import { db } from '@/lib/db/client';
import {
  botMessages,
  dailyCheckins,
  exercises,
  routineExercises,
  routines,
  sessions,
  streakNudges,
  telegramLinkCodes,
  users,
  userStreaks,
  workoutQueueMutations,
  workouts,
  workoutSets,
} from '@/lib/db/schema';
import * as workoutsService from '@/lib/services/workouts';
import { INACTIVE_WORKOUT_MESSAGE } from '@/lib/services/session-queue';
import type { WorkoutQueueActionResponse } from '@/types/session-queue';

async function wipe() {
  await db.delete(workoutQueueMutations);
  await db.delete(dailyCheckins);
  await db.delete(workoutSets);
  await db.delete(workouts);
  await db.delete(streakNudges);
  await db.delete(userStreaks);
  await db.delete(botMessages);
  await db.delete(telegramLinkCodes);
  await db.delete(routineExercises);
  await db.delete(routines);
  await db.delete(exercises);
  await db.delete(sessions);
  await db.delete(users);
}

async function authenticatedRequest(
  userId: number,
  url: string,
  method: string,
  body?: unknown,
): Promise<NextRequest> {
  const cookie = await issueSessionCookieHeader(userId);
  return new NextRequest(url, {
    method,
    headers: { cookie, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function malformedJsonRequest(
  userId: number,
  url: string,
  method: string,
): Promise<NextRequest> {
  const cookie = await issueSessionCookieHeader(userId);
  return new NextRequest(url, {
    method,
    headers: { cookie, 'content-type': 'application/json' },
    body: '{"exerciseId":',
  });
}

describe('POST /api/workouts/:id/skip and /hold', () => {
  let userId: number;
  let otherUserId: number;
  let benchId: number;
  let squatId: number;
  let routineId: number;

  beforeEach(async () => {
    await wipe();
    const [user] = await db
      .insert(users)
      .values({
        name: 'Queue Route',
        email: 'queue-route@test.com',
        passwordHash: 'hash',
      })
      .returning();
    const [other] = await db
      .insert(users)
      .values({
        name: 'Other Queue Route',
        email: 'other-queue-route@test.com',
        passwordHash: 'hash',
      })
      .returning();
    userId = user.id;
    otherUserId = other.id;

    const [bench] = await db
      .insert(exercises)
      .values({
        slug: 'bench-press',
        name: 'Press Banca',
        muscleGroup: 'Pecho',
        instructions: 'x',
        isSystem: true,
      })
      .returning();
    const [squat] = await db
      .insert(exercises)
      .values({
        slug: 'squat',
        name: 'Sentadilla',
        muscleGroup: 'Piernas',
        instructions: 'x',
        isSystem: true,
      })
      .returning();
    benchId = bench.id;
    squatId = squat.id;

    const [routine] = await db
      .insert(routines)
      .values({
        slug: 'queue-route',
        name: 'Cola route',
        kind: 'gym',
        restSeconds: 30,
        isSystem: true,
      })
      .returning();
    routineId = routine.id;
    await db.insert(routineExercises).values([
      { routineId, exerciseId: benchId, sortOrder: 1, targetSets: 1, targetReps: 5 },
      { routineId, exerciseId: squatId, sortOrder: 2, targetSets: 1, targetReps: 5 },
    ]);
  });

  it('returns 200 skip with persisted queue on GET workout', async () => {
    const workout = await workoutsService.createWorkout(userId, routineId);
    const response = await skipWorkout(
      await authenticatedRequest(
        userId,
        `http://localhost:3000/api/workouts/${workout.id}/skip`,
        'POST',
        { exerciseId: benchId, clientMutationId: 'route-skip-1' },
      ),
      { params: Promise.resolve({ id: String(workout.id) }) },
    );
    const body = (await response.json()) as WorkoutQueueActionResponse;

    expect(response.status).toBe(200);
    expect(body.action).toBe('skip');
    expect(body.duplicate).toBe(false);
    expect(body.queue.pendingExerciseIds).toEqual([squatId]);
    expect(body.queue.skippedExerciseIds).toEqual([benchId]);

    const getResponse = await getWorkout(
      await authenticatedRequest(userId, `http://localhost:3000/api/workouts/${workout.id}`, 'GET'),
      { params: Promise.resolve({ id: String(workout.id) }) },
    );
    const workoutBody = (await getResponse.json()) as {
      queue: WorkoutQueueActionResponse['queue'];
    };
    expect(getResponse.status).toBe(200);
    expect(workoutBody.queue.pendingExerciseIds).toEqual([squatId]);
    expect(workoutBody.queue.skippedExerciseIds).toEqual([benchId]);
  });

  it('returns 400 VALIDATION when the workout is not active', async () => {
    const workout = await workoutsService.createWorkout(userId, routineId);
    await workoutsService.updateWorkout(workout.id, userId, { endedAt: new Date() });

    const response = await holdWorkout(
      await authenticatedRequest(
        userId,
        `http://localhost:3000/api/workouts/${workout.id}/hold`,
        'POST',
        { exerciseId: benchId, clientMutationId: 'route-inactive' },
      ),
      { params: Promise.resolve({ id: String(workout.id) }) },
    );
    const body = (await response.json()) as { code: string; message: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION');
    expect(body.message).toBe(INACTIVE_WORKOUT_MESSAGE);
  });

  it('returns 400 VALIDATION for a malformed JSON body', async () => {
    const workout = await workoutsService.createWorkout(userId, routineId);
    const response = await skipWorkout(
      await malformedJsonRequest(
        userId,
        `http://localhost:3000/api/workouts/${workout.id}/skip`,
        'POST',
      ),
      { params: Promise.resolve({ id: String(workout.id) }) },
    );
    const body = (await response.json()) as { code: string; message: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION');
    expect(body.message).toEqual(expect.any(String));
  });

  it('returns 403 FORBIDDEN for a foreign workout', async () => {
    const workout = await workoutsService.createWorkout(otherUserId, routineId);
    const response = await skipWorkout(
      await authenticatedRequest(
        userId,
        `http://localhost:3000/api/workouts/${workout.id}/skip`,
        'POST',
        { exerciseId: benchId, clientMutationId: 'route-foreign' },
      ),
      { params: Promise.resolve({ id: String(workout.id) }) },
    );
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(403);
    expect(body.code).toBe('FORBIDDEN');
  });

  it('returns duplicate:true for a repeated clientMutationId', async () => {
    const workout = await workoutsService.createWorkout(userId, routineId);
    const first = await holdWorkout(
      await authenticatedRequest(
        userId,
        `http://localhost:3000/api/workouts/${workout.id}/hold`,
        'POST',
        { exerciseId: benchId, clientMutationId: 'route-dup' },
      ),
      { params: Promise.resolve({ id: String(workout.id) }) },
    );
    const second = await holdWorkout(
      await authenticatedRequest(
        userId,
        `http://localhost:3000/api/workouts/${workout.id}/hold`,
        'POST',
        { exerciseId: benchId, clientMutationId: 'route-dup' },
      ),
      { params: Promise.resolve({ id: String(workout.id) }) },
    );
    const firstBody = (await first.json()) as WorkoutQueueActionResponse;
    const secondBody = (await second.json()) as WorkoutQueueActionResponse;

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(firstBody.duplicate).toBe(false);
    expect(secondBody.duplicate).toBe(true);
    expect(secondBody.queue).toEqual(firstBody.queue);
    expect(secondBody.queue.pendingExerciseIds).toEqual([squatId, benchId]);
  });
});
