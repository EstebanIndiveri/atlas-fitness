import { describe, it, expect, beforeEach } from '@jest/globals';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { coachRecommendations, dailyCheckins, users, workouts } from '@/lib/db/schema';
import {
  decideCoachRecommendation,
  getCoachRecommendation,
  recordCoachRecommendation,
} from '@/lib/services/coach-recommendation';
import type { CoachAdaptationResult } from '@/types/coach';

const deterministicResult: CoachAdaptationResult = {
  original: { exerciseCount: 3, setCount: 9, estMinutes: 27 },
  adapted: { exerciseCount: 2, setCount: 6, estMinutes: 18 },
  exerciseDeltas: [
    { exerciseId: 101, name: 'Sentadilla', action: 'kept', fromSets: 3, toSets: 3 },
    { exerciseId: 102, name: 'Curl bíceps', action: 'removed', fromSets: 3, toSets: 0 },
    { exerciseId: 103, name: 'Plancha', action: 'kept', fromSets: 3, toSets: 3 },
  ],
  reason:
    'Bajamos volumen porque registraste energía baja: mantenemos los movimientos principales y recortamos accesorios.',
  source: 'deterministic',
};

const aiResult: CoachAdaptationResult = {
  ...deterministicResult,
  reason: 'Atlas sugiere bajar accesorios porque hoy registraste menos energía disponible.',
  source: 'ai',
};

describe('CoachRecommendation persistence service', () => {
  let userId: number;
  let otherUserId: number;
  let workoutId: number;
  let otherWorkoutId: number;
  let dailyCheckInId: number;

  beforeEach(async () => {
    await db.delete(coachRecommendations);
    await db.delete(dailyCheckins);
    await db.delete(workouts);
    await db.delete(users);

    const timestamp = Date.now();
    const [user, otherUser] = await db
      .insert(users)
      .values([
        {
          name: 'Coach User',
          email: `coach-${timestamp}@test.com`,
          passwordHash: await bcrypt.hash('Test1234!', 10),
        },
        {
          name: 'Other Coach User',
          email: `coach-other-${timestamp}@test.com`,
          passwordHash: await bcrypt.hash('Test1234!', 10),
        },
      ])
      .returning();

    userId = user.id;
    otherUserId = otherUser.id;

    const [workout, otherWorkout] = await db
      .insert(workouts)
      .values([
        { userId, startedAt: new Date('2026-09-19T18:00:00.000Z') },
        { userId: otherUserId, startedAt: new Date('2026-09-19T19:00:00.000Z') },
      ])
      .returning();

    workoutId = workout.id;
    otherWorkoutId = otherWorkout.id;

    const [checkIn] = await db
      .insert(dailyCheckins)
      .values({
        userId,
        localDate: '2026-09-19',
        mood: 3,
        energy: 'low',
      })
      .returning();

    dailyCheckInId = checkIn.id;
  });

  it('records a pending recommendation with the real source and serialized result', async () => {
    const recommendation = await recordCoachRecommendation({
      userId,
      workoutId,
      dailyCheckInId,
      source: 'deterministic',
      result: deterministicResult,
    });

    const [stored] = await db
      .select()
      .from(coachRecommendations)
      .where(eq(coachRecommendations.id, recommendation.id));

    expect(recommendation).toMatchObject({
      workoutId,
      dailyCheckInId,
      source: 'deterministic',
      decision: 'pending',
      decidedAt: null,
      result: deterministicResult,
    });
    expect(stored.source).toBe('deterministic');
    expect(stored.decision).toBe('pending');
    expect(JSON.parse(stored.resultJson)).toEqual(deterministicResult);
  });

  it('rejects recording a recommendation for another user workout without leaking ownership', async () => {
    await expect(
      recordCoachRecommendation({
        userId,
        workoutId: otherWorkoutId,
        source: 'ai',
        result: aiResult,
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Entrenamiento no encontrado',
    });
  });

  it('accepts a pending recommendation and sets decidedAt without mutating the stored result', async () => {
    const recommendation = await recordCoachRecommendation({ userId, workoutId, source: 'ai', result: aiResult });
    const accepted = await decideCoachRecommendation({ id: recommendation.id, userId, decision: 'accepted' });

    expect(accepted.decision).toBe('accepted');
    expect(accepted.decidedAt).toEqual(expect.any(String));
    expect(accepted.result).toEqual(aiResult);
  });

  it('rejects a pending recommendation and keeps the original result trace', async () => {
    const recommendation = await recordCoachRecommendation({
      userId, workoutId, source: 'deterministic', result: deterministicResult,
    });
    const rejected = await decideCoachRecommendation({ id: recommendation.id, userId, decision: 'rejected' });

    expect(rejected.decision).toBe('rejected');
    expect(rejected.decidedAt).toEqual(expect.any(String));
    expect(rejected.result).toEqual(deterministicResult);
  });

  it('rejects deciding an already decided recommendation with a typed conflict', async () => {
    const recommendation = await recordCoachRecommendation({
      userId, workoutId, source: 'deterministic', result: deterministicResult,
    });
    await decideCoachRecommendation({ id: recommendation.id, userId, decision: 'accepted' });

    await expect(
      decideCoachRecommendation({ id: recommendation.id, userId, decision: 'rejected' }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'La recomendación ya fue decidida',
    });
  });

  it('returns an existing recommendation on idempotent record without duplicating rows', async () => {
    const first = await recordCoachRecommendation({
      userId, workoutId, source: 'deterministic', result: deterministicResult,
    });
    const second = await recordCoachRecommendation({
      userId, workoutId, source: 'deterministic', result: deterministicResult,
    });

    const rows = await db
      .select()
      .from(coachRecommendations)
      .where(eq(coachRecommendations.workoutId, workoutId));

    expect(second.id).toBe(first.id);
    expect(rows).toHaveLength(1);
  });

  it('rejects invalid source and decision values with typed validation errors', async () => {
    await expect(
      recordCoachRecommendation({
        userId,
        workoutId,
        source: 'manual',
        result: deterministicResult,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });

    const recommendation = await recordCoachRecommendation({
      userId, workoutId, source: 'deterministic', result: deterministicResult,
    });
    await expect(
      decideCoachRecommendation({ id: recommendation.id, userId, decision: 'pending' }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('returns owned recommendations and null for missing or foreign rows', async () => {
    const recommendation = await recordCoachRecommendation({
      userId, workoutId, source: 'deterministic', result: deterministicResult,
    });
    await expect(getCoachRecommendation({ id: recommendation.id, userId })).resolves.toMatchObject({
      id: recommendation.id,
      result: deterministicResult,
    });
    await expect(getCoachRecommendation({ id: recommendation.id, userId: otherUserId })).resolves.toBeNull();
    await expect(getCoachRecommendation({ id: 999_999, userId })).resolves.toBeNull();
  });

  it('persists JSON context snapshots without fabricating source data', async () => {
    const recommendation = await recordCoachRecommendation({
      userId,
      workoutId,
      source: 'deterministic',
      result: deterministicResult,
      contextSnapshot: {
        energy: { value: 'low', source: 'user_input' },
        workoutId,
      },
    });

    expect(recommendation.contextSnapshot).toEqual({
      energy: { value: 'low', source: 'user_input' },
      workoutId,
    });
  });

  it('rejects non-JSON context snapshots with typed validation errors', async () => {
    const circularSnapshot: { self?: unknown } = {};
    circularSnapshot.self = circularSnapshot;

    await expect(
      recordCoachRecommendation({
        userId, workoutId, source: 'deterministic', result: deterministicResult,
        contextSnapshot: { value: () => 'not-json' },
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(
      recordCoachRecommendation({
        userId, workoutId, source: 'deterministic', result: deterministicResult,
        contextSnapshot: circularSnapshot,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});
