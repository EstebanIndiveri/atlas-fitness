import { describe, it, expect, beforeEach } from '@jest/globals';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { postWorkoutFeedback, users, workouts } from '@/lib/db/schema';
import {
  getPostWorkoutFeedback,
  recordPostWorkoutFeedback,
} from '@/lib/services/post-workout-feedback';

describe('PostWorkoutFeedback adaptive service', () => {
  let userId: number;
  let otherUserId: number;

  beforeEach(async () => {
    await db.delete(postWorkoutFeedback);
    await db.delete(workouts);
    await db.delete(users);

    const timestamp = Date.now();
    const [user, otherUser] = await db
      .insert(users)
      .values([
        {
          name: 'Feedback User',
          email: `feedback-${timestamp}@test.com`,
          passwordHash: await bcrypt.hash('Test1234!', 10),
        },
        {
          name: 'Other Feedback User',
          email: `feedback-other-${timestamp}@test.com`,
          passwordHash: await bcrypt.hash('Test1234!', 10),
        },
      ])
      .returning();

    userId = user.id;
    otherUserId = otherUser.id;
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

  it('records explicit feedback and returns it with user_input metric sources', async () => {
    const workoutId = await createEndedWorkout(userId);

    const recorded = await recordPostWorkoutFeedback({
      userId,
      workoutId,
      effort: 8,
      sensation: 'hard',
      discomfort: [{ area: 'shoulder', intensity: 'mild' }],
      note: 'La última serie costó.',
    });
    const found = await getPostWorkoutFeedback(workoutId, userId);

    expect(recorded).toEqual({
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
    expect(found).toEqual(recorded);
  });

  it('updates the existing row on re-submit instead of inserting a duplicate', async () => {
    const workoutId = await createEndedWorkout(userId);
    const first = await recordPostWorkoutFeedback({
      userId,
      workoutId,
      effort: 5,
      sensation: 'good',
      discomfort: [],
      note: 'Bien.',
    });

    const second = await recordPostWorkoutFeedback({
      userId,
      workoutId,
      effort: 7,
      sensation: 'neutral',
      discomfort: [{ area: 'knee', intensity: 'moderate' }],
      note: null,
    });

    const rows = await db
      .select()
      .from(postWorkoutFeedback)
      .where(eq(postWorkoutFeedback.workoutId, workoutId));

    expect(second.id).toBe(first.id);
    expect(second.effort.value).toBe(7);
    expect(second.sensation.value).toBe('neutral');
    expect(second.discomfort.value).toEqual([{ area: 'knee', intensity: 'moderate' }]);
    expect(second.note).toBeNull();
    expect(rows).toHaveLength(1);
  });

  it('rejects feedback for another user workout without leaking ownership', async () => {
    const workoutId = await createEndedWorkout(userId);

    await expect(
      recordPostWorkoutFeedback({
        userId: otherUserId,
        workoutId,
        effort: 6,
        sensation: 'good',
        discomfort: [],
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Entrenamiento no encontrado',
    });
  });

  it('rejects invalid effort, sensation, discomfort, mood, and note with typed errors', async () => {
    const workoutId = await createEndedWorkout(userId);
    const validPayload = {
      userId,
      workoutId,
      effort: 6,
      sensation: 'good',
      discomfort: [],
    };

    await expect(
      recordPostWorkoutFeedback({ ...validPayload, effort: 0 }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });

    await expect(
      recordPostWorkoutFeedback({ ...validPayload, sensation: 'awesome' }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });

    await expect(
      recordPostWorkoutFeedback({
        ...validPayload,
        discomfort: [{ area: 'shoulder', intensity: 'severe' }],
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });

    await expect(
      recordPostWorkoutFeedback({ ...validPayload, mood: 5 }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });

    await expect(
      recordPostWorkoutFeedback({ ...validPayload, note: 'x'.repeat(501) }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('stores omitted optional fields as null or empty explicit values without fabrication', async () => {
    const workoutId = await createEndedWorkout(userId);

    const recorded = await recordPostWorkoutFeedback({
      userId,
      workoutId,
      effort: 4,
      sensation: 'good',
      discomfort: [],
    });

    expect(recorded.note).toBeNull();
    expect(recorded.discomfort).toEqual({ value: [], source: 'user_input' });
  });

  it('rejects feedback for workouts that are still open', async () => {
    const [workout] = await db
      .insert(workouts)
      .values({
        userId,
        startedAt: new Date('2026-09-16T21:00:00.000Z'),
      })
      .returning();

    await expect(
      recordPostWorkoutFeedback({
        userId,
        workoutId: workout.id,
        effort: 6,
        sensation: 'good',
        discomfort: [],
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
      message: 'El entrenamiento debe estar finalizado',
    });
  });
});
