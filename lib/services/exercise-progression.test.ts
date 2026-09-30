/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, it } from '@jest/globals';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import {
  exercises,
  sessions,
  users,
  workoutSets,
  workouts,
} from '@/lib/db/schema';
import {
  DEFAULT_PROGRESSION_HISTORY_LIMIT,
  getExerciseProgression,
} from './exercise-progression';
import type { ExerciseProgressionInput } from './exercise-progression';

const USER_A = 7101;
const USER_B = 7102;
const EX_A = 7101;
const EX_OTHER = 7102;
const REPS = 5;

const V1_EXTERNAL = {
  semanticCaptureVersion: 1,
  loadMode: 'external',
  amountBasis: 'total',
  side: 'bilateral',
  setPurpose: 'working',
  repCountBasis: null,
} as const;

type SemanticsInput = typeof V1_EXTERNAL | 'legacy' | Record<string, unknown>;

interface SetOverrides {
  setIndex?: number;
  reps?: number;
  weightKg?: string;
  completed?: boolean;
  deleted?: boolean;
  semantics?: SemanticsInput;
}

async function seedUser(id: number, label: string): Promise<void> {
  await db.insert(users).values({
    id,
    name: label,
    email: `${label}@progression.test`,
    passwordHash: 'hash',
  });
}

async function seedExercise(id: number, opts: { deleted?: boolean } = {}): Promise<void> {
  await db.insert(exercises).values({
    id,
    slug: `progression-ex-${id}`,
    name: `Exercise ${id}`,
    muscleGroup: 'Pecho',
    instructions: 'x',
    isSystem: true,
    deletedAt: opts.deleted ? new Date('2026-01-01T00:00:00.000Z') : null,
  });
}

async function seedWorkout(
  id: number,
  userId: number,
  opts: { startedAt: Date; endedAt: Date | null; deleted?: boolean },
): Promise<void> {
  await db.insert(workouts).values({
    id,
    userId,
    startedAt: opts.startedAt,
    endedAt: opts.endedAt,
    deletedAt: opts.deleted ? new Date('2026-01-02T00:00:00.000Z') : null,
  });
}

function semanticsValues(semantics: SemanticsInput): Partial<typeof workoutSets.$inferInsert> {
  if (semantics === 'legacy') {
    return {
      semanticCaptureVersion: null,
      loadMode: null,
      amountBasis: null,
      side: null,
      setPurpose: null,
      repCountBasis: null,
    };
  }
  return { ...V1_EXTERNAL, ...semantics };
}

async function seedSet(
  workoutId: number,
  exerciseId: number,
  overrides: SetOverrides = {},
): Promise<number> {
  const [row] = await db
    .insert(workoutSets)
    .values({
      workoutId,
      exerciseId,
      setIndex: overrides.setIndex ?? 1,
      reps: overrides.reps ?? REPS,
      weightKg: overrides.weightKg ?? '100',
      completed: overrides.completed ?? true,
      deletedAt: overrides.deleted ? new Date('2026-01-03T00:00:00.000Z') : null,
      ...semanticsValues(overrides.semantics ?? V1_EXTERNAL),
    })
    .returning({ id: workoutSets.id });
  return row.id;
}

/** A closed workout at a distinct, increasing close time, with one eligible set. */
async function seedClosedWorkoutWithSet(
  workoutId: number,
  userId: number,
  exerciseId: number,
  weightKg: string,
  closeSecond: number,
): Promise<void> {
  await seedWorkout(workoutId, userId, {
    startedAt: new Date((1_700_000_000 + closeSecond) * 1000),
    endedAt: new Date((1_700_000_000 + closeSecond) * 1000),
  });
  await seedSet(workoutId, exerciseId, { weightKg });
}

function progressionInput(overrides: Partial<ExerciseProgressionInput> = {}): ExerciseProgressionInput {
  return {
    exerciseId: EX_A,
    userId: USER_A,
    reps: REPS,
    amountBasis: 'total',
    side: 'bilateral',
    limit: DEFAULT_PROGRESSION_HISTORY_LIMIT,
    cursor: null,
    ...overrides,
  };
}

async function run(overrides: Partial<ExerciseProgressionInput> = {}) {
  return getExerciseProgression(progressionInput(overrides));
}

beforeEach(async () => {
  await db.delete(workoutSets);
  await db.delete(workouts);
  await db.delete(exercises);
  await db.delete(sessions);
  await db.delete(users);

  await seedUser(USER_A, 'user-a');
  await seedUser(USER_B, 'user-b');
  await seedExercise(EX_A);
  await seedExercise(EX_OTHER);
});

describe('getExerciseProgression — statuses', () => {
  it('returns no_history when the exercise has no live sets', async () => {
    const result = await run();
    expect(result.readStatus).toBe('no_history');
    expect(result.currentRepresentative).toBeNull();
    expect(result.currentBest).toBeNull();
    expect(result.comparison).toBeNull();
    expect(result.history.items).toHaveLength(0);
    expect(result.metricId).toBe('same_reps_external_load');
    expect(result.progressionRuleVersion).toBe(1);
    expect(result.provenance).toBe('atlas_computed');
    expect(result.reasons).toEqual([]);
  });

  it('returns history_without_semantics for legacy-only history', async () => {
    await seedWorkout(900, USER_A, {
      startedAt: new Date(1_700_000_000_000),
      endedAt: new Date(1_700_000_000_000),
    });
    await seedSet(900, EX_A, { semantics: 'legacy', weightKg: '80' });

    const result = await run();
    expect(result.readStatus).toBe('history_without_semantics');
    expect(result.reasons).toEqual(['unknown_semantics']);
    expect(result.history.items[0]?.semantics).toBeNull();
  });

  it('returns no_comparable_set when semantics exist but no cohort set', async () => {
    await seedWorkout(901, USER_A, {
      startedAt: new Date(1_700_000_000_000),
      endedAt: new Date(1_700_000_000_000),
    });
    // Same exercise but a different reps value.
    await seedSet(901, EX_A, { reps: REPS + 1, weightKg: '100' });

    const result = await run();
    expect(result.readStatus).toBe('no_comparable_set');
    expect(result.reasons).toEqual(['no_eligible_closed_workout']);
    expect(result.currentRepresentative).toBeNull();
  });
});

describe('getExerciseProgression — comparison', () => {
  it('marks the first eligible closed workout as baseline', async () => {
    await seedClosedWorkoutWithSet(1000, USER_A, EX_A, '100', 1);
    const result = await run();
    expect(result.readStatus).toBe('ready');
    expect(result.currentRepresentative?.weightKg).toBe('100');
    expect(result.previousComparableRepresentative).toBeNull();
    expect(result.currentBest?.weightKg).toBe('100');
    expect(result.comparison).toBe('baseline');
    expect(result.reasons).toEqual(['eligible']);
  });

  it('marks a strictly greater load as new_pr against the best before it', async () => {
    await seedClosedWorkoutWithSet(1000, USER_A, EX_A, '100', 1);
    await seedClosedWorkoutWithSet(1001, USER_A, EX_A, '110', 2);
    const result = await run();
    expect(result.comparison).toBe('new_pr');
    expect(result.previousComparableRepresentative?.weightKg).toBe('100');
    expect(result.currentBest?.weightKg).toBe('110');
  });

  it('marks an equal load as ties_best', async () => {
    await seedClosedWorkoutWithSet(1000, USER_A, EX_A, '110', 1);
    await seedClosedWorkoutWithSet(1001, USER_A, EX_A, '110', 2);
    const result = await run();
    expect(result.comparison).toBe('ties_best');
  });

  it('marks a lower load as below_best', async () => {
    await seedClosedWorkoutWithSet(1000, USER_A, EX_A, '120', 1);
    await seedClosedWorkoutWithSet(1001, USER_A, EX_A, '110', 2);
    const result = await run();
    expect(result.comparison).toBe('below_best');
    expect(result.currentBest?.weightKg).toBe('120');
  });
});

describe('getExerciseProgression — representative selection', () => {
  it('selects the highest eligible set within the latest workout', async () => {
    await seedWorkout(1000, USER_A, {
      startedAt: new Date(1_700_000_000_000),
      endedAt: new Date(1_700_000_000_000),
    });
    await seedSet(1000, EX_A, { setIndex: 1, weightKg: '90' });
    await seedSet(1000, EX_A, { setIndex: 2, weightKg: '100' });
    await seedSet(1000, EX_A, { setIndex: 3, weightKg: '95' });

    const result = await run();
    expect(result.currentRepresentative?.weightKg).toBe('100');
    expect(result.currentRepresentative?.setIndex).toBe(2);
  });

  it('breaks equal-amount ties within a workout by the lowest (setIndex, setId)', async () => {
    await seedWorkout(1000, USER_A, {
      startedAt: new Date(1_700_000_000_000),
      endedAt: new Date(1_700_000_000_000),
    });
    const first = await seedSet(1000, EX_A, { setIndex: 1, weightKg: '100' });
    const second = await seedSet(1000, EX_A, { setIndex: 2, weightKg: '100' });

    const result = await run();
    expect(result.currentRepresentative?.weightKg).toBe('100');
    expect(result.currentRepresentative?.setId).toBe(first);
    expect(second).not.toBe(first);
  });

  it('orders workouts by endedAt then workoutId when end times collide', async () => {
    const endedAt = new Date(1_700_000_000_000);
    await seedWorkout(1000, USER_A, { startedAt: endedAt, endedAt });
    await seedSet(1000, EX_A, { weightKg: '100' });
    await seedWorkout(1001, USER_A, { startedAt: endedAt, endedAt });
    await seedSet(1001, EX_A, { weightKg: '105' });

    const result = await run();
    expect(result.currentRepresentative?.workoutId).toBe(1001);
    expect(result.currentRepresentative?.weightKg).toBe('105');
    expect(result.previousComparableRepresentative?.workoutId).toBe(1000);
    expect(result.comparison).toBe('new_pr');
  });
});

describe('getExerciseProgression — eligibility exclusions', () => {
  it('excludes open workouts from the representative and the history page', async () => {
    await seedWorkout(1000, USER_A, { startedAt: new Date(1_700_000_000_000), endedAt: null });
    await seedSet(1000, EX_A, { weightKg: '100' });

    const result = await run();
    expect(result.readStatus).toBe('no_comparable_set');
    expect(result.currentRepresentative).toBeNull();
    expect(result.history.items).toHaveLength(0);
  });

  it('excludes incomplete sets', async () => {
    await seedClosedWorkoutWithSet(1000, USER_A, EX_A, '100', 1);
    await seedSet(1000, EX_A, { setIndex: 2, weightKg: '150', completed: false });
    const result = await run();
    expect(result.currentRepresentative?.weightKg).toBe('100');
  });

  it('excludes deleted sets', async () => {
    await seedClosedWorkoutWithSet(1000, USER_A, EX_A, '100', 1);
    await seedSet(1000, EX_A, { setIndex: 2, weightKg: '150', deleted: true });
    const result = await run();
    expect(result.currentRepresentative?.weightKg).toBe('100');
  });

  it('excludes deleted workouts', async () => {
    await seedWorkout(1000, USER_A, {
      startedAt: new Date(1_700_000_000_000),
      endedAt: new Date(1_700_000_000_000),
      deleted: true,
    });
    await seedSet(1000, EX_A, { weightKg: '100' });

    const result = await run();
    expect(result.readStatus).toBe('no_history');
    expect(result.history.items).toHaveLength(0);
  });

  it('rejects a deleted or inaccessible exercise with NOT_FOUND', async () => {
    await seedExercise(9999, { deleted: true });
    await expect(run({ exerciseId: 9999 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it.each([
    ['warmup', { setPurpose: 'warmup' }],
    ['bodyweight', { loadMode: 'bodyweight', amountBasis: null, weightKg: '0' }],
    ['bodyweight_added', { loadMode: 'bodyweight_added' }],
    ['assisted', { loadMode: 'assisted' }],
    ['alternating', { side: 'alternating', repCountBasis: 'total' }],
  ] as const)('excludes %s rows from the external metric', async (_label, semantics) => {
    await seedWorkout(1000, USER_A, {
      startedAt: new Date(1_700_000_000_000),
      endedAt: new Date(1_700_000_000_000),
    });
    await seedSet(1000, EX_A, {
      weightKg: 'weightKg' in semantics ? (semantics.weightKg as string) : '100',
      semantics,
    });

    const result = await run();
    expect(result.readStatus).toBe('no_comparable_set');
    expect(result.currentRepresentative).toBeNull();
  });
});

describe('getExerciseProgression — cohort isolation', () => {
  it('isolates amountBasis', async () => {
    await seedWorkout(1000, USER_A, {
      startedAt: new Date(1_700_000_000_000),
      endedAt: new Date(1_700_000_000_000),
    });
    await seedSet(1000, EX_A, { semantics: { amountBasis: 'per_side' }, weightKg: '20' });
    const result = await run({ amountBasis: 'total' });
    expect(result.readStatus).toBe('no_comparable_set');
  });

  it('isolates left and right sides', async () => {
    await seedWorkout(1000, USER_A, {
      startedAt: new Date(1_700_000_000_000),
      endedAt: new Date(1_700_000_000_000),
    });
    await seedSet(1000, EX_A, { semantics: { side: 'left' }, weightKg: '20' });

    expect((await run({ side: 'bilateral' })).readStatus).toBe('no_comparable_set');
    expect((await run({ side: 'left' })).readStatus).toBe('ready');
    expect((await run({ side: 'right' })).readStatus).toBe('no_comparable_set');
  });

  it('isolates reps', async () => {
    await seedWorkout(1000, USER_A, {
      startedAt: new Date(1_700_000_000_000),
      endedAt: new Date(1_700_000_000_000),
    });
    await seedSet(1000, EX_A, { reps: 8, weightKg: '100' });
    expect((await run({ reps: 5 })).readStatus).toBe('no_comparable_set');
    expect((await run({ reps: 8 })).readStatus).toBe('ready');
  });

  it('isolates the exact exercise identity and never joins by name', async () => {
    await seedClosedWorkoutWithSet(1000, USER_A, EX_OTHER, '200', 1);
    await seedWorkout(1001, USER_A, {
      startedAt: new Date(1_700_000_100_000),
      endedAt: new Date(1_700_000_100_000),
    });
    await seedSet(1001, EX_A, { semantics: 'legacy', weightKg: '1' });

    const result = await run({ exerciseId: EX_A });
    expect(result.readStatus).toBe('history_without_semantics');
    expect(result.currentBest).toBeNull();
  });

  it('isolates owners and never includes another user’s rows', async () => {
    // User B has a huge all-time best; user A must not see it.
    await seedClosedWorkoutWithSet(2000, USER_B, EX_A, '999', 1);
    await seedClosedWorkoutWithSet(2001, USER_B, EX_A, '999', 2);
    await seedClosedWorkoutWithSet(1000, USER_A, EX_A, '100', 3);

    const result = await run();
    expect(result.currentBest?.weightKg).toBe('100');
    expect(result.comparison).toBe('baseline');
    expect(result.history.items.every((item) => item.workoutId !== 2000 && item.workoutId !== 2001)).toBe(true);
  });
});

describe('getExerciseProgression — recomputation, pagination and decimal ordering', () => {
  it('recomputes current truth after a set is soft-deleted', async () => {
    await seedClosedWorkoutWithSet(1000, USER_A, EX_A, '100', 1);
    await seedWorkout(1001, USER_A, {
      startedAt: new Date(1_700_000_100_000),
      endedAt: new Date(1_700_000_100_000),
    });
    const laterSetId = await seedSet(1001, EX_A, { weightKg: '110' });

    expect((await run()).comparison).toBe('new_pr');

    await db.update(workoutSets).set({ deletedAt: new Date() }).where(eq(workoutSets.id, laterSetId));

    const after = await run();
    expect(after.currentRepresentative?.weightKg).toBe('100');
    expect(after.currentBest?.weightKg).toBe('100');
    expect(after.comparison).toBe('baseline');
  });

  it('keeps the PR answer independent of the history limit', async () => {
    await seedClosedWorkoutWithSet(1000, USER_A, EX_A, '100', 1);
    await seedClosedWorkoutWithSet(1001, USER_A, EX_A, '110', 2);
    await seedClosedWorkoutWithSet(1002, USER_A, EX_A, '105', 3);

    const limited = await run({ limit: 1 });
    const full = await run({ limit: 50 });

    expect(limited.history.items).toHaveLength(1);
    expect(limited.comparison).toBe(full.comparison);
    expect(limited.currentBest?.weightKg).toBe(full.currentBest?.weightKg);
    expect(limited.currentRepresentative?.weightKg).toBe(full.currentRepresentative?.weightKg);
  });

  it('keeps the PR answer independent of the history cursor page', async () => {
    await seedClosedWorkoutWithSet(1000, USER_A, EX_A, '100', 1);
    await seedClosedWorkoutWithSet(1001, USER_A, EX_A, '110', 2);
    await seedClosedWorkoutWithSet(1002, USER_A, EX_A, '105', 3);

    const firstPage = await run({ limit: 1 });
    expect(firstPage.history.nextCursor).not.toBeNull();
    const secondPage = await run({ limit: 1, cursor: firstPage.history.nextCursor });

    expect(secondPage.history.items).toHaveLength(1);
    expect(secondPage.comparison).toBe(firstPage.comparison);
    expect(secondPage.currentBest?.weightKg).toBe(firstPage.currentBest?.weightKg);
    expect(secondPage.history.items[0]?.workoutId).not.toBe(firstPage.history.items[0]?.workoutId);
  });

  it('rejects a malformed cursor', async () => {
    await expect(run({ cursor: 'not-a-cursor' })).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('orders amounts by exact decimal value (result vectors)', async () => {
    const amounts = ['1.01', '1.1', '9.9', '10', '10.01', '100'];
    for (let i = 0; i < amounts.length; i += 1) {
      await seedClosedWorkoutWithSet(1000 + i, USER_A, EX_A, amounts[i], i + 1);
    }

    const result = await run();
    expect(result.currentBest?.weightKg).toBe('100');
    // Latest workout holds 100, so the current comparison is a new PR over 10.01.
    expect(result.currentRepresentative?.weightKg).toBe('100');
    expect(result.comparison).toBe('new_pr');
  });

  it('selects 1.1 over 1.01 within one workout', async () => {
    await seedWorkout(1000, USER_A, {
      startedAt: new Date(1_700_000_000_000),
      endedAt: new Date(1_700_000_000_000),
    });
    await seedSet(1000, EX_A, { setIndex: 1, weightKg: '1.01' });
    await seedSet(1000, EX_A, { setIndex: 2, weightKg: '1.1' });

    const result = await run();
    expect(result.currentRepresentative?.weightKg).toBe('1.1');
  });

  it('exposes typed provenance and reason codes', async () => {
    await seedClosedWorkoutWithSet(1000, USER_A, EX_A, '100', 1);
    const result = await run();
    expect(result).toMatchObject({
      metricId: 'same_reps_external_load',
      progressionRuleVersion: 1,
      provenance: 'atlas_computed',
      cohort: {
        exerciseId: EX_A,
        loadMode: 'external',
        amountBasis: 'total',
        side: 'bilateral',
        reps: REPS,
      },
      currentRepresentative: {
        semantics: { semanticCaptureVersion: 1, loadMode: 'external', setPurpose: 'working' },
        provenance: 'user_input',
      },
    });
    expect(result.currentRepresentative?.endedAt).toMatch(/Z$/);
    expect(result.currentRepresentative?.localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
