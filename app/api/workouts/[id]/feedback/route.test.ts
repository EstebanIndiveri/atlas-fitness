/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, it } from '@jest/globals';
import { NextRequest } from 'next/server';

import { GET, POST } from './route';
import { issueSessionCookieHeader } from '@/lib/auth/session-store';
import { db } from '@/lib/db/client';
import { postWorkoutFeedback, sessions, users, workouts } from '@/lib/db/schema';

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

function feedbackUrl(id: number | string): string {
  return `http://localhost:3000/api/workouts/${id}/feedback`;
}

function unauthenticatedRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('/api/workouts/[id]/feedback', () => {
  let userId: number;
  let otherUserId: number;
  let workoutId: number;

  beforeEach(async () => {
    await db.delete(postWorkoutFeedback);
    await db.delete(workouts);
    await db.delete(sessions);
    await db.delete(users);

    const [user, otherUser] = await db
      .insert(users)
      .values([
        {
          name: 'Feedback Route User',
          email: 'feedback-route@test.com',
          passwordHash: 'hash',
        },
        {
          name: 'Other Feedback Route User',
          email: 'feedback-route-other@test.com',
          passwordHash: 'hash',
        },
      ])
      .returning();

    userId = user.id;
    otherUserId = otherUser.id;

    const [workout] = await db
      .insert(workouts)
      .values({
        userId,
        startedAt: new Date('2026-09-16T21:00:00.000Z'),
        endedAt: new Date('2026-09-17T02:30:00.000Z'),
      })
      .returning();

    workoutId = workout.id;
  });

  async function createEndedWorkout(ownerId: number): Promise<number> {
    const [workout] = await db
      .insert(workouts)
      .values({
        userId: ownerId,
        startedAt: new Date('2026-09-16T21:00:00.000Z'),
        endedAt: new Date('2026-09-17T02:30:00.000Z'),
      })
      .returning();

    return workout.id;
  }

  async function postFeedback(id: number | string, body: unknown) {
    return POST(await authenticatedRequest(userId, feedbackUrl(id), 'POST', body), {
      params: Promise.resolve({ id: String(id) }),
    });
  }

  async function getFeedback(id: number | string) {
    return GET(await authenticatedRequest(userId, feedbackUrl(id), 'GET'), {
      params: Promise.resolve({ id: String(id) }),
    });
  }

  it('POST records valid feedback and returns HTTP 200', async () => {
    const response = await postFeedback(workoutId, {
      effort: 8,
      sensation: 'hard',
      discomfort: [{ area: 'shoulder', intensity: 'mild' }],
      note: 'La última serie costó.',
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: expect.any(Number),
      workoutId,
      localDate: '2026-09-16',
      effort: { value: 8, source: 'user_input' },
      sensation: { value: 'hard', source: 'user_input' },
      discomfort: {
        value: [{ area: 'shoulder', intensity: 'mild' }],
        source: 'user_input',
      },
      note: 'La última serie costó.',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it('POST returns 404 NOT_FOUND for a workout not owned by the user', async () => {
    const foreignWorkoutId = await createEndedWorkout(otherUserId);
    const response = await postFeedback(foreignWorkoutId, {
      effort: 6,
      sensation: 'good',
      discomfort: [],
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: 'NOT_FOUND',
      message: 'Entrenamiento no encontrado',
    });
  });

  it('POST ignores body userId and workoutId overrides from the client', async () => {
    const foreignWorkoutId = await createEndedWorkout(otherUserId);
    const response = await postFeedback(workoutId, {
      userId: otherUserId,
      workoutId: foreignWorkoutId,
      effort: 6,
      sensation: 'good',
      discomfort: [],
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ workoutId });

    const foreignFeedback = await db.query.postWorkoutFeedback.findFirst({
      where: (feedback, { eq }) => eq(feedback.workoutId, foreignWorkoutId),
    });
    expect(foreignFeedback).toBeUndefined();
  });

  it('POST returns 400 VALIDATION for an invalid body', async () => {
    const response = await postFeedback(workoutId, {
      effort: 11,
      sensation: 'great',
      discomfort: [],
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION' });
  });

  it('GET returns recorded feedback for the owned workout', async () => {
    await db.insert(postWorkoutFeedback).values({
      userId,
      workoutId,
      localDate: '2026-09-16',
      effort: 7,
      sensation: 'good',
      discomfortJson: JSON.stringify([{ area: 'knee', intensity: 'moderate' }]),
      note: null,
    });

    const response = await getFeedback(workoutId);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: expect.any(Number),
      workoutId,
      localDate: '2026-09-16',
      effort: { value: 7, source: 'user_input' },
      sensation: { value: 'good', source: 'user_input' },
      discomfort: {
        value: [{ area: 'knee', intensity: 'moderate' }],
        source: 'user_input',
      },
      note: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it('GET returns null when feedback is absent for the owned workout', async () => {
    const response = await getFeedback(workoutId);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toBeNull();
  });

  it('returns 401 UNAUTHORIZED without a session', async () => {
    const response = await POST(
      unauthenticatedRequest(
        feedbackUrl(workoutId),
        'POST',
        { effort: 6, sensation: 'good', discomfort: [] },
      ),
      { params: Promise.resolve({ id: String(workoutId) }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('returns 400 VALIDATION for an invalid workout id param', async () => {
    const response = await getFeedback('123abc');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'VALIDATION',
      message: 'ID de entrenamiento inválido',
    });
  });
});
