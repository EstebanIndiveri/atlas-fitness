/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, it } from '@jest/globals';

import { db } from '@/lib/db/client';
import { exercises, sessions, users, workoutSets, workouts } from '@/lib/db/schema';
import {
  DEFAULT_RAW_HISTORY_LIMIT,
  getExerciseHistory,
} from './stats';

const USER_A = 7201;
const USER_B = 7202;
const EX_A = 7201;
const EX_OTHER = 7202;

const V1 = {
  semanticCaptureVersion: 1,
  loadMode: 'external',
  amountBasis: 'total',
  side: 'bilateral',
  setPurpose: 'working',
  repCountBasis: null,
} as const;

async function seedUser(id: number, label: string): Promise<void> {
  await db.insert(users).values({
    id,
    name: label,
    email: `${label}@raw-history.test`,
    passwordHash: 'hash',
  });
}

async function seedExercise(id: number): Promise<void> {
  await db.insert(exercises).values({
    id,
    slug: `raw-history-${id}`,
    name: `Exercise ${id}`,
    muscleGroup: 'Pecho',
    instructions: 'x',
    isSystem: true,
  });
}

async function seedWorkout(
  id: number,
  userId: number,
  startedAt: Date,
  opts: { endedAt?: Date | null; deleted?: boolean } = {},
): Promise<void> {
  await db.insert(workouts).values({
    id,
    userId,
    startedAt,
    endedAt: opts.endedAt === undefined ? startedAt : opts.endedAt,
    deletedAt: opts.deleted ? new Date('2026-01-02T00:00:00.000Z') : null,
  });
}

async function seedSet(
  workoutId: number,
  exerciseId: number,
  opts: { setIndex?: number; weightKg?: string; legacy?: boolean; deleted?: boolean } = {},
): Promise<void> {
  await db.insert(workoutSets).values({
    workoutId,
    exerciseId,
    setIndex: opts.setIndex ?? 1,
    reps: 5,
    weightKg: opts.weightKg ?? '100',
    completed: true,
    deletedAt: opts.deleted ? new Date('2026-01-03T00:00:00.000Z') : null,
    ...(opts.legacy
      ? {
          semanticCaptureVersion: null,
          loadMode: null,
          amountBasis: null,
          side: null,
          setPurpose: null,
          repCountBasis: null,
        }
      : V1),
  });
}

beforeEach(async () => {
  await db.delete(workoutSets);
  await db.delete(workouts);
  await db.delete(exercises);
  await db.delete(sessions);
  await db.delete(users);

  await seedUser(USER_A, 'raw-a');
  await seedUser(USER_B, 'raw-b');
  await seedExercise(EX_A);
  await seedExercise(EX_OTHER);
});

describe('getExerciseHistory (bounded raw compatibility)', () => {
  it('returns declared semantics for v1 rows and null semantics for legacy rows', async () => {
    await seedWorkout(1000, USER_A, new Date(1_700_000_000_000));
    await seedSet(1000, EX_A, { setIndex: 1, weightKg: '100' });
    await seedSet(1000, EX_A, { setIndex: 2, weightKg: '80', legacy: true });

    const page = await getExerciseHistory(EX_A, USER_A);
    expect(page.history).toHaveLength(2);
    const v1 = page.history.find((entry) => entry.setIndex === 1);
    const legacy = page.history.find((entry) => entry.setIndex === 2);
    expect(v1?.semanticCaptureVersion).toBe(1);
    expect(v1?.loadMode).toBe('external');
    expect(legacy?.semanticCaptureVersion).toBeNull();
    expect(legacy?.weightKg).toBe('80');
    expect(page.bounded).toBe(true);
    expect(page.nextCursor).toBeNull();
  });

  it('never exposes PR/improvement/strength fields', async () => {
    await seedWorkout(1000, USER_A, new Date(1_700_000_000_000));
    await seedSet(1000, EX_A, { weightKg: '100' });

    const page = await getExerciseHistory(EX_A, USER_A);
    const entry = page.history[0] as unknown as Record<string, unknown>;
    for (const forbidden of ['isPr', 'isPR', 'improvement', 'strength', 'normalizedResistance', 'pr']) {
      expect(entry[forbidden]).toBeUndefined();
    }
  });

  it('bounds the page and continues with a keyset cursor', async () => {
    for (let i = 0; i < 5; i += 1) {
      await seedWorkout(1000 + i, USER_A, new Date((1_700_000_000 + i) * 1000));
      await seedSet(1000 + i, EX_A, { weightKg: String(100 + i) });
    }

    const first = await getExerciseHistory(EX_A, USER_A, { limit: 2 });
    expect(first.history).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    // Newest workout first.
    expect(first.history[0]?.workoutId).toBe(1004);

    const second = await getExerciseHistory(EX_A, USER_A, { limit: 2, cursor: first.nextCursor });
    expect(second.history).toHaveLength(2);
    const firstIds = first.history.map((entry) => entry.setId);
    const secondIds = second.history.map((entry) => entry.setId);
    expect(secondIds.some((id) => firstIds.includes(id))).toBe(false);
  });

  it('uses a default bound when no limit is provided', async () => {
    for (let i = 0; i < 3; i += 1) {
      await seedWorkout(1000 + i, USER_A, new Date((1_700_000_000 + i) * 1000));
      await seedSet(1000 + i, EX_A, { weightKg: '100' });
    }
    const page = await getExerciseHistory(EX_A, USER_A);
    expect(page.history.length).toBeLessThanOrEqual(DEFAULT_RAW_HISTORY_LIMIT);
  });

  it('isolates owners and exact exercises', async () => {
    await seedWorkout(1000, USER_A, new Date(1_700_000_000_000));
    await seedSet(1000, EX_A, { weightKg: '100' });
    await seedWorkout(2000, USER_B, new Date(1_700_000_500_000));
    await seedSet(2000, EX_A, { weightKg: '999' });
    await seedWorkout(1001, USER_A, new Date(1_700_000_100_000));
    await seedSet(1001, EX_OTHER, { weightKg: '777' });

    const page = await getExerciseHistory(EX_A, USER_A);
    expect(page.history).toHaveLength(1);
    expect(page.history[0]?.weightKg).toBe('100');
  });

  it('excludes deleted sets and deleted workouts', async () => {
    await seedWorkout(1000, USER_A, new Date(1_700_000_000_000));
    await seedSet(1000, EX_A, { setIndex: 1, weightKg: '100' });
    await seedSet(1000, EX_A, { setIndex: 2, weightKg: '110', deleted: true });
    await seedWorkout(1001, USER_A, new Date(1_700_000_100_000), { deleted: true });
    await seedSet(1001, EX_A, { weightKg: '120' });

    const page = await getExerciseHistory(EX_A, USER_A);
    expect(page.history).toHaveLength(1);
    expect(page.history[0]?.weightKg).toBe('100');
  });

  it('includes open workouts as raw history', async () => {
    await seedWorkout(1000, USER_A, new Date(1_700_000_000_000), { endedAt: null });
    await seedSet(1000, EX_A, { weightKg: '100' });
    const page = await getExerciseHistory(EX_A, USER_A);
    expect(page.history).toHaveLength(1);
  });

  it('rejects a malformed cursor and inaccessible exercise', async () => {
    await expect(getExerciseHistory(EX_A, USER_A, { cursor: 'bad' })).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    await expect(getExerciseHistory(9999, USER_A)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
