import { beforeEach, describe, expect, it } from '@jest/globals';
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import {
  coachRecommendations,
  exercises,
  habitLogs,
  postWorkoutFeedback,
  routineExercises,
  routines,
  scheduledRoutines,
  trainingPlans,
  users,
  workoutExerciseNotes,
  workoutQueueMutations,
  workouts,
  workoutSets,
} from '@/lib/db/schema';
import { parseExerciseSessionContext } from '@/lib/session/exercise-session-memory';
import { applyWorkoutQueueAction } from '@/lib/services/session-queue';
import {
  deleteWorkoutExerciseNote,
  getExerciseSessionContext,
  putWorkoutExerciseNote,
} from '@/lib/services/exercise-session-memory';

const CREATE = { expectedNoteId: null, expectedVersion: null } as const;

const AFTERNOON = new Date('2026-09-17T18:00:00.000Z');
// 2026-09-17T02:00:00Z is 2026-09-16 23:00 in Córdoba (UTC-3).
const LATE_NIGHT = new Date('2026-09-17T02:00:00.000Z');

async function createUser(email: string): Promise<number> {
  const [row] = await db
    .insert(users)
    .values({ name: email, email, passwordHash: 'hash' })
    .returning({ id: users.id });
  return row!.id;
}

async function createExercise(
  overrides: { slug: string; isSystem: boolean; userId?: number | null; deletedAt?: Date | null },
): Promise<number> {
  const [row] = await db
    .insert(exercises)
    .values({
      slug: overrides.slug,
      name: overrides.slug,
      muscleGroup: 'Pecho',
      instructions: 'x',
      isSystem: overrides.isSystem,
      userId: overrides.userId ?? null,
      deletedAt: overrides.deletedAt ?? null,
    })
    .returning({ id: exercises.id });
  return row!.id;
}

async function createRoutine(userId: number, exerciseIds: readonly number[]): Promise<number> {
  const [routine] = await db
    .insert(routines)
    .values({
      slug: `routine-${Math.random().toString(36).slice(2)}`,
      name: 'Rutina',
      isSystem: false,
      userId,
    })
    .returning({ id: routines.id });
  const routineId = routine!.id;
  let order = 1;
  for (const exerciseId of exerciseIds) {
    await db.insert(routineExercises).values({
      routineId,
      exerciseId,
      sortOrder: order,
      targetSets: 3,
      targetReps: 10,
    });
    order += 1;
  }
  return routineId;
}

async function createWorkout(overrides: {
  userId: number;
  routineId?: number | null;
  endedAt?: Date | null;
  deletedAt?: Date | null;
  startedAt?: Date;
}): Promise<number> {
  const [row] = await db
    .insert(workouts)
    .values({
      userId: overrides.userId,
      routineId: overrides.routineId ?? null,
      startedAt: overrides.startedAt ?? AFTERNOON,
      endedAt: overrides.endedAt ?? null,
      deletedAt: overrides.deletedAt ?? null,
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
  deletedAt?: Date | null;
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
      deletedAt: overrides.deletedAt ?? null,
    })
    .returning({ id: workoutSets.id });
  return row!.id;
}

function put(
  userId: number,
  workoutId: number,
  exerciseId: number,
  note: string,
  token: { expectedNoteId: number | null; expectedVersion: number | null } = CREATE,
) {
  return putWorkoutExerciseNote(userId, workoutId, exerciseId, { note, ...token });
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

describe('exercise-session memory service', () => {
  let userId: number;
  let otherUserId: number;
  let exerciseId: number;
  let otherExerciseId: number;

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
    await db.delete(exercises);
    await db.delete(users);

    userId = await createUser('owner@example.com');
    otherUserId = await createUser('intruder@example.com');
    exerciseId = await createExercise({ slug: 'bench', isSystem: true });
    otherExerciseId = await createExercise({ slug: 'squat', isSystem: true });
  });

  describe('PUT transition table', () => {
    it('creates version 1 for a routine member before any set exists', async () => {
      const routineId = await createRoutine(userId, [exerciseId]);
      const workoutId = await createWorkout({ userId, routineId });

      const result = await put(userId, workoutId, exerciseId, '  recordar  ');

      expect(result.created).toBe(true);
      expect(result.note).toMatchObject({
        userId,
        workoutId,
        exerciseId,
        note: 'recordar',
        version: 1,
      });
      expect(typeof result.note.createdAt).toBe('string');
      expect(typeof result.note.updatedAt).toBe('string');
    });

    it('treats a repeated create with the same normalized note as idempotent without a bump', async () => {
      const routineId = await createRoutine(userId, [exerciseId]);
      const workoutId = await createWorkout({ userId, routineId });
      const first = await put(userId, workoutId, exerciseId, 'nota');

      const second = await put(userId, workoutId, exerciseId, '  nota  ');

      expect(second.created).toBe(false);
      expect(second.note.id).toBe(first.note.id);
      expect(second.note.version).toBe(1);
      expect(await db.select().from(workoutExerciseNotes)).toHaveLength(1);
    });

    it('rejects a create with a different note when a row already exists', async () => {
      const routineId = await createRoutine(userId, [exerciseId]);
      const workoutId = await createWorkout({ userId, routineId });
      await put(userId, workoutId, exerciseId, 'primera');

      await expect(put(userId, workoutId, exerciseId, 'segunda', CREATE)).rejects.toMatchObject({
        code: 'CONFLICT',
      });
      expect((await noteRow(workoutId, exerciseId))?.note).toBe('primera');
    });

    it('updates with an exact current token and bumps the version', async () => {
      const routineId = await createRoutine(userId, [exerciseId]);
      const workoutId = await createWorkout({ userId, routineId });
      const first = await put(userId, workoutId, exerciseId, 'v1');

      const updated = await put(userId, workoutId, exerciseId, 'v2', {
        expectedNoteId: first.note.id,
        expectedVersion: 1,
      });

      expect(updated.created).toBe(false);
      expect(updated.note.id).toBe(first.note.id);
      expect(updated.note.version).toBe(2);
      expect(updated.note.note).toBe('v2');
    });

    it('is idempotent for the same note with a stale version (zero-row write re-read)', async () => {
      const routineId = await createRoutine(userId, [exerciseId]);
      const workoutId = await createWorkout({ userId, routineId });
      const first = await put(userId, workoutId, exerciseId, 'v1');
      await put(userId, workoutId, exerciseId, 'v2', {
        expectedNoteId: first.note.id,
        expectedVersion: 1,
      });

      const retry = await put(userId, workoutId, exerciseId, 'v2', {
        expectedNoteId: first.note.id,
        expectedVersion: 1,
      });

      expect(retry.created).toBe(false);
      expect(retry.note.version).toBe(2);
      expect(retry.note.note).toBe('v2');
    });

    it('is idempotent for the same note with the now-current version', async () => {
      const routineId = await createRoutine(userId, [exerciseId]);
      const workoutId = await createWorkout({ userId, routineId });
      const first = await put(userId, workoutId, exerciseId, 'v1');

      const retry = await put(userId, workoutId, exerciseId, 'v1', {
        expectedNoteId: first.note.id,
        expectedVersion: 1,
      });

      expect(retry.note.version).toBe(1);
      expect(retry.note.id).toBe(first.note.id);
    });

    it('rejects a stale version paired with a different note', async () => {
      const routineId = await createRoutine(userId, [exerciseId]);
      const workoutId = await createWorkout({ userId, routineId });
      const first = await put(userId, workoutId, exerciseId, 'v1');
      await put(userId, workoutId, exerciseId, 'v2', {
        expectedNoteId: first.note.id,
        expectedVersion: 1,
      });

      await expect(
        put(userId, workoutId, exerciseId, 'v3', {
          expectedNoteId: first.note.id,
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      expect((await noteRow(workoutId, exerciseId))?.note).toBe('v2');
    });

    it('rejects a token that points at a different id', async () => {
      const routineId = await createRoutine(userId, [exerciseId]);
      const workoutId = await createWorkout({ userId, routineId });
      const first = await put(userId, workoutId, exerciseId, 'v1');

      await expect(
        put(userId, workoutId, exerciseId, 'v2', {
          expectedNoteId: first.note.id + 1000,
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('rejects a token when the row has disappeared (replaced)', async () => {
      const routineId = await createRoutine(userId, [exerciseId]);
      const workoutId = await createWorkout({ userId, routineId });
      const first = await put(userId, workoutId, exerciseId, 'v1');
      await deleteWorkoutExerciseNote(userId, workoutId, exerciseId, {
        expectedNoteId: first.note.id,
        expectedVersion: 1,
      });

      await expect(
        put(userId, workoutId, exerciseId, 'v2', {
          expectedNoteId: first.note.id,
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('rejects malformed tokens and empty or oversized notes as VALIDATION', async () => {
      const routineId = await createRoutine(userId, [exerciseId]);
      const workoutId = await createWorkout({ userId, routineId });

      await expect(put(userId, workoutId, exerciseId, '   ')).rejects.toMatchObject({
        code: 'VALIDATION',
      });
      await expect(
        put(userId, workoutId, exerciseId, 'x'.repeat(281)),
      ).rejects.toMatchObject({ code: 'VALIDATION' });
      await expect(
        put(userId, workoutId, exerciseId, 'nota', {
          expectedNoteId: 1,
          expectedVersion: null,
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION' });
    });
  });

  describe('DELETE transition table', () => {
    it('deletes with the exact current token', async () => {
      const routineId = await createRoutine(userId, [exerciseId]);
      const workoutId = await createWorkout({ userId, routineId });
      const first = await put(userId, workoutId, exerciseId, 'v1');

      await expect(
        deleteWorkoutExerciseNote(userId, workoutId, exerciseId, {
          expectedNoteId: first.note.id,
          expectedVersion: 1,
        }),
      ).resolves.toEqual({ note: null });
      expect(await noteRow(workoutId, exerciseId)).toBeUndefined();
    });

    it('is idempotent when no row exists', async () => {
      const routineId = await createRoutine(userId, [exerciseId]);
      const workoutId = await createWorkout({ userId, routineId });

      await expect(
        deleteWorkoutExerciseNote(userId, workoutId, exerciseId, {
          expectedNoteId: 12345,
          expectedVersion: 1,
        }),
      ).resolves.toEqual({ note: null });
    });

    it('rejects a stale token when a different/recreated row exists', async () => {
      const routineId = await createRoutine(userId, [exerciseId]);
      const workoutId = await createWorkout({ userId, routineId });
      const first = await put(userId, workoutId, exerciseId, 'v1');
      await deleteWorkoutExerciseNote(userId, workoutId, exerciseId, {
        expectedNoteId: first.note.id,
        expectedVersion: 1,
      });
      const recreated = await put(userId, workoutId, exerciseId, 'recreada');

      await expect(
        deleteWorkoutExerciseNote(userId, workoutId, exerciseId, {
          expectedNoteId: first.note.id,
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      expect((await noteRow(workoutId, exerciseId))?.id).toBe(recreated.note.id);
    });
  });

  describe('forced races', () => {
    it('serializes a create/create race into one row with one idempotent retry', async () => {
      const routineId = await createRoutine(userId, [exerciseId]);
      const workoutId = await createWorkout({ userId, routineId });

      const outcomes = await Promise.all([
        put(userId, workoutId, exerciseId, 'misma'),
        put(userId, workoutId, exerciseId, 'misma'),
      ]);

      expect(outcomes.map((outcome) => outcome.note.id)).toEqual([
        outcomes[0]!.note.id,
        outcomes[0]!.note.id,
      ]);
      expect(outcomes.filter((outcome) => outcome.created)).toHaveLength(1);
      expect(await db.select().from(workoutExerciseNotes)).toHaveLength(1);
    });

    it('lets exactly one of two concurrent updates win the same token', async () => {
      const routineId = await createRoutine(userId, [exerciseId]);
      const workoutId = await createWorkout({ userId, routineId });
      const first = await put(userId, workoutId, exerciseId, 'base');

      const outcomes = await Promise.allSettled([
        put(userId, workoutId, exerciseId, 'A', {
          expectedNoteId: first.note.id,
          expectedVersion: 1,
        }),
        put(userId, workoutId, exerciseId, 'B', {
          expectedNoteId: first.note.id,
          expectedVersion: 1,
        }),
      ]);

      expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
      const row = await noteRow(workoutId, exerciseId);
      expect(row?.version).toBe(2);
      expect(['A', 'B']).toContain(row?.note);
    });

    it('does not corrupt state in a delete/recreate race', async () => {
      const routineId = await createRoutine(userId, [exerciseId]);
      const workoutId = await createWorkout({ userId, routineId });
      const first = await put(userId, workoutId, exerciseId, 'base');

      const outcomes = await Promise.allSettled([
        deleteWorkoutExerciseNote(userId, workoutId, exerciseId, {
          expectedNoteId: first.note.id,
          expectedVersion: 1,
        }),
        put(userId, workoutId, exerciseId, 'nueva', CREATE),
      ]);

      expect(outcomes[0]!.status).toBe('fulfilled');
      const rows = await db.select().from(workoutExerciseNotes);
      expect(rows.length).toBeLessThanOrEqual(1);
      for (const row of rows) {
        expect(row.note).toBe('nueva');
        expect(row.version).toBe(1);
      }
    });
  });

  describe('closed workout immutability', () => {
    it('rejects create/update/delete once the workout ended and freezes the note', async () => {
      const routineId = await createRoutine(userId, [exerciseId]);
      const workoutId = await createWorkout({ userId, routineId });
      const saved = await put(userId, workoutId, exerciseId, 'congelada');
      await db.update(workouts).set({ endedAt: AFTERNOON }).where(eq(workouts.id, workoutId));

      await expect(put(userId, workoutId, exerciseId, 'otra')).rejects.toMatchObject({
        code: 'VALIDATION',
      });
      await expect(
        put(userId, workoutId, exerciseId, 'actualizada', {
          expectedNoteId: saved.note.id,
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION' });
      await expect(
        deleteWorkoutExerciseNote(userId, workoutId, exerciseId, {
          expectedNoteId: saved.note.id,
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION' });

      expect((await noteRow(workoutId, exerciseId))?.note).toBe('congelada');
    });
  });

  describe('eligibility and ownership', () => {
    it('allows a manual exercise only after a same-exercise set exists', async () => {
      const workoutId = await createWorkout({ userId });

      await expect(put(userId, workoutId, exerciseId, 'prematura')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });

      await createSet({ workoutId, exerciseId, setIndex: 1 });
      await expect(put(userId, workoutId, exerciseId, 'manual')).resolves.toMatchObject({
        note: { note: 'manual' },
      });
    });

    it('allows an exercise that is not in the routine once it has a set', async () => {
      const routineId = await createRoutine(userId, [otherExerciseId]);
      const workoutId = await createWorkout({ userId, routineId });
      await createSet({ workoutId, exerciseId, setIndex: 1 });

      await expect(put(userId, workoutId, exerciseId, 'agregado')).resolves.toMatchObject({
        note: { note: 'agregado' },
      });
    });

    it('rejects an unrelated exercise with NOT_FOUND', async () => {
      const routineId = await createRoutine(userId, [otherExerciseId]);
      const workoutId = await createWorkout({ userId, routineId });

      await expect(put(userId, workoutId, exerciseId, 'ajena')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('rejects a soft-deleted custom exercise as NOT_FOUND', async () => {
      const privateExerciseId = await createExercise({
        slug: 'privada',
        isSystem: false,
        userId,
        deletedAt: AFTERNOON,
      });
      const routineId = await createRoutine(userId, [privateExerciseId]);
      const workoutId = await createWorkout({ userId, routineId });

      await expect(put(userId, workoutId, privateExerciseId, 'nota')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it("rejects a foreign exercise owned by another user as NOT_FOUND", async () => {
      const foreignExerciseId = await createExercise({
        slug: 'ajena-privada',
        isSystem: false,
        userId: otherUserId,
      });
      const routineId = await createRoutine(userId, [exerciseId]);
      const workoutId = await createWorkout({ userId, routineId });

      await expect(put(userId, workoutId, foreignExerciseId, 'nota')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('rejects reading or writing another user workout with FORBIDDEN', async () => {
      const routineId = await createRoutine(userId, [exerciseId]);
      const workoutId = await createWorkout({ userId, routineId });

      await expect(getExerciseSessionContext(otherUserId, workoutId, exerciseId)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await expect(put(otherUserId, workoutId, exerciseId, 'x')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await expect(
        deleteWorkoutExerciseNote(otherUserId, workoutId, exerciseId, {
          expectedNoteId: 1,
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('hides a soft-deleted workout as NOT_FOUND', async () => {
      const workoutId = await createWorkout({ userId, deletedAt: AFTERNOON });

      await expect(getExerciseSessionContext(userId, workoutId, exerciseId)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('skip/hold preservation and side-effect isolation', () => {
    it('keeps a saved note when the exercise is skipped or held', async () => {
      const routineId = await createRoutine(userId, [exerciseId, otherExerciseId]);
      const workoutId = await createWorkout({ userId, routineId });
      await put(userId, workoutId, exerciseId, 'persistente');

      await applyWorkoutQueueAction({
        workoutId,
        userId,
        action: 'skip',
        exerciseId: otherExerciseId,
        clientMutationId: 'skip-1',
      });
      await applyWorkoutQueueAction({
        workoutId,
        userId,
        action: 'hold',
        exerciseId: exerciseId,
        clientMutationId: 'hold-1',
      });

      const context = await getExerciseSessionContext(userId, workoutId, exerciseId);
      expect(context.currentNote?.note).toBe('persistente');
    });

    it('does not mutate sets, queue, routine, plan or feedback', async () => {
      const routineId = await createRoutine(userId, [exerciseId]);
      const workoutId = await createWorkout({ userId, routineId });
      await createSet({ workoutId, exerciseId, setIndex: 1 });
      await db.update(workouts).set({ queueJson: '{"pending":[]}', queueVersion: 5 }).where(eq(workouts.id, workoutId));

      const saved = await put(userId, workoutId, exerciseId, 'v1');
      await put(userId, workoutId, exerciseId, 'v2', {
        expectedNoteId: saved.note.id,
        expectedVersion: 1,
      });
      await deleteWorkoutExerciseNote(userId, workoutId, exerciseId, {
        expectedNoteId: saved.note.id,
        expectedVersion: 2,
      });

      const [workout] = await db.select().from(workouts).where(eq(workouts.id, workoutId));
      expect(workout?.queueJson).toBe('{"pending":[]}');
      expect(workout?.queueVersion).toBe(5);
      expect(await db.select().from(workoutSets)).toHaveLength(1);
      expect(await db.select().from(routineExercises)).toHaveLength(1);
      expect(await db.select().from(trainingPlans)).toHaveLength(0);
      expect(await db.select().from(postWorkoutFeedback)).toHaveLength(0);
    });
  });

  describe('context read model', () => {
    it('returns an all-null context for a fresh routine member', async () => {
      const routineId = await createRoutine(userId, [exerciseId]);
      const workoutId = await createWorkout({ userId, routineId });

      const context = await getExerciseSessionContext(userId, workoutId, exerciseId);

      expect(context).toEqual({
        workoutId,
        exerciseId,
        currentNote: null,
        lastCompletedSets: null,
        lastCompletedNote: null,
      });
      expect(parseExerciseSessionContext(context)).toEqual(context);
    });

    it('returns the saved current note and never the open workout as history', async () => {
      const routineId = await createRoutine(userId, [exerciseId]);
      const workoutId = await createWorkout({ userId, routineId });
      await createSet({ workoutId, exerciseId, setIndex: 1 });
      const saved = await put(userId, workoutId, exerciseId, 'actual');

      const context = await getExerciseSessionContext(userId, workoutId, exerciseId);

      expect(context.currentNote?.id).toBe(saved.note.id);
      expect(context.lastCompletedSets).toBeNull();
      expect(context.lastCompletedNote).toBeNull();
      expect(parseExerciseSessionContext(context)).toEqual(context);
    });

    it('returns sets from the latest completed workout ordered by setIndex', async () => {
      const routineId = await createRoutine(userId, [exerciseId]);
      const earlier = await createWorkout({
        userId,
        routineId,
        endedAt: new Date('2026-09-10T18:00:00.000Z'),
      });
      const later = await createWorkout({
        userId,
        routineId,
        endedAt: new Date('2026-09-11T18:00:00.000Z'),
      });
      await createSet({ workoutId: earlier, exerciseId, setIndex: 1, weightKg: '10.5' });
      await createSet({ workoutId: later, exerciseId, setIndex: 3, weightKg: '20.25' });
      await createSet({ workoutId: later, exerciseId, setIndex: 1, weightKg: '22.5' });
      const active = await createWorkout({ userId, routineId });

      const context = await getExerciseSessionContext(userId, active, exerciseId);

      expect(context.lastCompletedSets).toMatchObject({
        workoutId: later,
        exerciseId,
        localDate: '2026-09-11',
      });
      expect(context.lastCompletedSets?.sets.map((set) => set.setIndex)).toEqual([1, 3]);
      expect(context.lastCompletedSets?.sets.map((set) => set.weightKg)).toEqual(['22.5', '20.25']);
      expect(parseExerciseSessionContext(context)).toEqual(context);
    });

    it('resolves the latest note independently from the latest sets', async () => {
      const routineId = await createRoutine(userId, [exerciseId]);
      const setsWorkout = await createWorkout({
        userId,
        routineId,
        endedAt: new Date('2026-09-10T18:00:00.000Z'),
      });
      const noteWorkout = await createWorkout({
        userId,
        routineId,
        endedAt: new Date('2026-09-12T18:00:00.000Z'),
      });
      await createSet({ workoutId: setsWorkout, exerciseId, setIndex: 1 });
      await db.insert(workoutExerciseNotes).values({
        userId,
        workoutId: noteWorkout,
        exerciseId,
        note: 'la última nota',
        version: 1,
        createdAt: AFTERNOON,
        updatedAt: AFTERNOON,
      });
      const active = await createWorkout({ userId, routineId });

      const context = await getExerciseSessionContext(userId, active, exerciseId);

      expect(context.lastCompletedSets?.workoutId).toBe(setsWorkout);
      expect(context.lastCompletedSets?.localDate).toBe('2026-09-10');
      expect(context.lastCompletedNote).toMatchObject({
        workoutId: noteWorkout,
        exerciseId,
        note: 'la última nota',
        localDate: '2026-09-12',
      });
      expect(context.lastCompletedNote?.workoutId).not.toBe(context.lastCompletedSets?.workoutId);
      expect(parseExerciseSessionContext(context)).toEqual(context);
    });

    it('orders by endedAt then workout id', async () => {
      const routineId = await createRoutine(userId, [exerciseId]);
      const sameInstant = new Date('2026-09-11T18:00:00.000Z');
      const first = await createWorkout({ userId, routineId, endedAt: sameInstant });
      const second = await createWorkout({ userId, routineId, endedAt: sameInstant });
      await createSet({ workoutId: first, exerciseId, setIndex: 1, weightKg: '1' });
      await createSet({ workoutId: second, exerciseId, setIndex: 1, weightKg: '2' });
      const active = await createWorkout({ userId, routineId });

      const context = await getExerciseSessionContext(userId, active, exerciseId);

      expect(context.lastCompletedSets?.workoutId).toBe(second);
    });

    it('excludes soft-deleted workouts and sets from history', async () => {
      const routineId = await createRoutine(userId, [exerciseId]);
      const deletedWorkout = await createWorkout({
        userId,
        routineId,
        endedAt: new Date('2026-09-12T18:00:00.000Z'),
        deletedAt: AFTERNOON,
      });
      await createSet({ workoutId: deletedWorkout, exerciseId, setIndex: 1 });
      const liveWorkout = await createWorkout({
        userId,
        routineId,
        endedAt: new Date('2026-09-11T18:00:00.000Z'),
      });
      await createSet({ workoutId: liveWorkout, exerciseId, setIndex: 1 });
      await createSet({
        workoutId: liveWorkout,
        exerciseId,
        setIndex: 2,
        completed: false,
      });
      await createSet({
        workoutId: liveWorkout,
        exerciseId,
        setIndex: 3,
        deletedAt: AFTERNOON,
      });
      const active = await createWorkout({ userId, routineId });

      const context = await getExerciseSessionContext(userId, active, exerciseId);

      expect(context.lastCompletedSets?.workoutId).toBe(liveWorkout);
      expect(context.lastCompletedSets?.sets.map((set) => set.setIndex)).toEqual([1]);
    });

    it('uses the Córdoba local date, not UTC, for the display date', async () => {
      const routineId = await createRoutine(userId, [exerciseId]);
      const workoutId = await createWorkout({ userId, routineId, endedAt: LATE_NIGHT });
      await createSet({ workoutId, exerciseId, setIndex: 1 });
      const active = await createWorkout({ userId, routineId });

      const context = await getExerciseSessionContext(userId, active, exerciseId);

      expect(context.lastCompletedSets?.localDate).toBe('2026-09-16');
    });

    it('keeps an open workout out of history while still showing its current note', async () => {
      const routineId = await createRoutine(userId, [exerciseId]);
      const completed = await createWorkout({
        userId,
        routineId,
        endedAt: new Date('2026-09-10T18:00:00.000Z'),
      });
      await createSet({ workoutId: completed, exerciseId, setIndex: 1 });
      const active = await createWorkout({ userId, routineId });
      await createSet({ workoutId: active, exerciseId, setIndex: 1 });
      await put(userId, active, exerciseId, 'en curso');

      const context = await getExerciseSessionContext(userId, active, exerciseId);

      expect(context.currentNote?.workoutId).toBe(active);
      expect(context.lastCompletedSets?.workoutId).toBe(completed);
      expect(context.lastCompletedNote).toBeNull();
    });
  });
});
