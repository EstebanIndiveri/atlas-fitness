import { beforeAll, describe, expect, it } from '@jest/globals';
import { and, asc, desc, eq, exists, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { exercises, users, workouts, workoutSets } from '@/lib/db/schema';

/**
 * v0.12 Workstream B query-plan gate.
 *
 * The approved scalability claim has two independent access patterns:
 *
 * 1. The exact all-time PR cohort aggregate resolves through the additive partial
 *    expression index `workout_sets_external_pr_cohort_idx`, ordered by the
 *    decimal-exact `weight_kg` expressions, without a temp B-tree sort.
 * 2. The bounded exact-exercise history page walks `workouts_user_id_ended_at_idx`
 *    then a `workout_sets` index, without a temp B-tree sort.
 *
 * The page limit must never affect the PR answer, so the aggregate is a separate
 * query over all history. If SQLite ever stops choosing an indexed plan, this
 * suite fails instead of silently degrading to an unbounded scan.
 */

const USER_ID = 9101;
const EXERCISE_ID = 9101;
const OTHER_EXERCISE_ID = 9102;
const SECONDARY_EXERCISE_ID = 9103;
const ORDER_EXERCISE_ID = 9104;
const REPS = 5;
const ORDER_REPS = 12;
const CURRENT_WORKOUT_ID = 999_999;
const CURRENT_ENDED_AT = new Date(1_710_000_000 * 1000);

const WEIGHT_INTEGER_LENGTH_DESC = sql`(length(CASE WHEN instr(${workoutSets.weightKg}, '.') = 0 THEN ${workoutSets.weightKg} ELSE substr(${workoutSets.weightKg}, 1, instr(${workoutSets.weightKg}, '.') - 1) END)) DESC`;
const WEIGHT_INTEGER_PART_DESC = sql`(CASE WHEN instr(${workoutSets.weightKg}, '.') = 0 THEN ${workoutSets.weightKg} ELSE substr(${workoutSets.weightKg}, 1, instr(${workoutSets.weightKg}, '.') - 1) END) DESC`;
const WEIGHT_FRACTION_PART_DESC = sql`(CASE WHEN instr(${workoutSets.weightKg}, '.') = 0 THEN '' ELSE substr(${workoutSets.weightKg}, instr(${workoutSets.weightKg}, '.') + 1) END) DESC`;

/** Exact all-time top lookup for one closed-workout external-load cohort. */
function exactCohortAggregateQuery(
  exerciseId: number,
  reps: number,
  priorEndedAt?: Date,
  priorWorkoutId?: number,
): SQL {
  const eligibility = and(
    eq(workouts.id, workoutSets.workoutId),
    eq(workouts.userId, USER_ID),
    isNull(workouts.deletedAt),
    isNotNull(workouts.endedAt),
    priorEndedAt === undefined || priorWorkoutId === undefined
      ? undefined
      : or(
          lt(workouts.endedAt, priorEndedAt),
          and(eq(workouts.endedAt, priorEndedAt), lt(workouts.id, priorWorkoutId)),
        ),
  );

  return db
    .select({ id: workoutSets.id, weightKg: workoutSets.weightKg })
    .from(workoutSets)
    .where(
      and(
        eq(workoutSets.exerciseId, exerciseId),
        eq(workoutSets.loadMode, 'external'),
        eq(workoutSets.amountBasis, 'total'),
        eq(workoutSets.side, 'bilateral'),
        eq(workoutSets.reps, reps),
        eq(workoutSets.setPurpose, 'working'),
        isNull(workoutSets.deletedAt),
        eq(workoutSets.completed, true),
        exists(db.select({ one: sql`1` }).from(workouts).where(eligibility)),
      ),
    )
    .orderBy(WEIGHT_INTEGER_LENGTH_DESC, WEIGHT_INTEGER_PART_DESC, WEIGHT_FRACTION_PART_DESC)
    .limit(1)
    .getSQL();
}

/** Bounded exact-exercise history page with a keyset cursor, owner-first. */
function boundedHistoryPageQuery(): SQL {
  return db
    .select({ id: workoutSets.id, weightKg: workoutSets.weightKg })
    .from(workouts)
    .innerJoin(workoutSets, eq(workoutSets.workoutId, workouts.id))
    .where(
      and(
        eq(workouts.userId, USER_ID),
        isNull(workouts.deletedAt),
        isNotNull(workouts.endedAt),
        eq(workoutSets.exerciseId, EXERCISE_ID),
        isNull(workoutSets.deletedAt),
        or(
          lt(workouts.endedAt, CURRENT_ENDED_AT),
          and(eq(workouts.endedAt, CURRENT_ENDED_AT), lt(workouts.id, CURRENT_WORKOUT_ID)),
        ),
      ),
    )
    .orderBy(desc(workouts.endedAt), desc(workouts.id), asc(workoutSets.setIndex), asc(workoutSets.id))
    .limit(50)
    .getSQL();
}

async function explain(query: SQL): Promise<string[]> {
  const rows = await db.all<{ detail: string }>(sql`EXPLAIN QUERY PLAN ${query}`);
  return rows.map((row) => row.detail);
}

describe('workout sets semantics query plan gate', () => {
  beforeAll(async () => {
    await seed();
  });

  async function seed(): Promise<void> {
    await db.insert(users).values({
      id: USER_ID,
      name: 'Plan User',
      email: 'semantics-plan-user@example.com',
      passwordHash: 'hash',
    });
    await db.insert(exercises).values([
      {
        id: EXERCISE_ID,
        slug: 'semantics-plan-exercise',
        name: 'Plan Exercise',
        muscleGroup: 'Pecho',
        instructions: 'x',
        isSystem: true,
      },
      {
        id: OTHER_EXERCISE_ID,
        slug: 'semantics-plan-exercise-other',
        name: 'Plan Exercise Other',
        muscleGroup: 'Pecho',
        instructions: 'x',
        isSystem: true,
      },
      {
        id: SECONDARY_EXERCISE_ID,
        slug: 'semantics-plan-exercise-secondary',
        name: 'Plan Exercise Secondary',
        muscleGroup: 'Pecho',
        instructions: 'x',
        isSystem: true,
      },
      {
        id: ORDER_EXERCISE_ID,
        slug: 'semantics-plan-exercise-order',
        name: 'Plan Exercise Order',
        muscleGroup: 'Pecho',
        instructions: 'x',
        isSystem: true,
      },
    ]);

    // Primary user: 60 closed workouts, each holding the target cohort plus other
    // cohorts that must never enter the exact aggregate.
    for (let i = 1; i <= 60; i += 1) {
      const workoutId = 2_000 + i;
      await db.insert(workouts).values({
        id: workoutId,
        userId: USER_ID,
        startedAt: new Date((1_700_000_000 + i) * 1000),
        endedAt: new Date((1_700_000_000 + i) * 1000),
      });
      await db.insert(workoutSets).values([
        {
          workoutId,
          exerciseId: EXERCISE_ID,
          setIndex: 1,
          reps: REPS,
          weightKg: `10${i}`,
          completed: true,
          semanticCaptureVersion: 1,
          loadMode: 'external',
          amountBasis: 'total',
          side: 'bilateral',
          setPurpose: 'working',
        },
        {
          workoutId,
          exerciseId: EXERCISE_ID,
          setIndex: 2,
          reps: REPS,
          weightKg: `11${i}`,
          completed: true,
          semanticCaptureVersion: 1,
          loadMode: 'external',
          amountBasis: 'per_side',
          side: 'bilateral',
          setPurpose: 'working',
        },
        {
          workoutId,
          exerciseId: SECONDARY_EXERCISE_ID,
          setIndex: 3,
          reps: REPS + 1,
          weightKg: `12${i}`,
          completed: true,
          semanticCaptureVersion: 1,
          loadMode: 'external',
          amountBasis: 'total',
          side: 'bilateral',
          setPurpose: 'working',
        },
      ]);
    }

    // Cross-user noise: several other owners with their own closed workouts and
    // sets for the same exercise identity.
    for (let other = 1; other <= 5; other += 1) {
      const otherUserId = USER_ID + other;
      await db.insert(users).values({
        id: otherUserId,
        name: `Other ${other}`,
        email: `semantics-plan-other-${other}@example.com`,
        passwordHash: 'hash',
      });
      for (let i = 1; i <= 20; i += 1) {
        const workoutId = 3_000 + other * 100 + i;
        await db.insert(workouts).values({
          id: workoutId,
          userId: otherUserId,
          startedAt: new Date((1_700_500_000 + i) * 1000),
          endedAt: new Date((1_700_500_000 + i) * 1000),
        });
        await db.insert(workoutSets).values([
          {
            workoutId,
            exerciseId: EXERCISE_ID,
            setIndex: 1,
            reps: REPS,
            weightKg: `20${i}`,
            completed: true,
            semanticCaptureVersion: 1,
            loadMode: 'external',
            amountBasis: 'total',
            side: 'bilateral',
            setPurpose: 'working',
          },
          {
            workoutId,
            exerciseId: OTHER_EXERCISE_ID,
            setIndex: 2,
            reps: REPS,
            weightKg: `15${i}`,
            completed: true,
            semanticCaptureVersion: 1,
            loadMode: 'external',
            amountBasis: 'total',
            side: 'bilateral',
            setPurpose: 'working',
          },
        ]);
      }
    }

    // Decimal-exact ordering vector for the correctness assertion.
    const orderWeights = ['100', '99.9', '9.9', '1.1', '1.01'];
    for (let i = 0; i < orderWeights.length; i += 1) {
      const workoutId = 5_000 + i;
      await db.insert(workouts).values({
        id: workoutId,
        userId: USER_ID,
        startedAt: new Date((1_700_900_000 + i) * 1000),
        endedAt: new Date((1_700_900_000 + i) * 1000),
      });
      await db.insert(workoutSets).values({
        workoutId,
        exerciseId: ORDER_EXERCISE_ID,
        setIndex: 1,
        reps: ORDER_REPS,
        weightKg: orderWeights[i],
        completed: true,
        semanticCaptureVersion: 1,
        loadMode: 'external',
        amountBasis: 'total',
        side: 'bilateral',
        setPurpose: 'working',
      });
    }
  }

  it('resolves the exact all-time cohort aggregate through the expression index without a temp sort', async () => {
    const plan = await explain(exactCohortAggregateQuery(EXERCISE_ID, REPS));
    const joined = plan.join('\n');

    expect(plan.some((line) => line.includes('workout_sets_external_pr_cohort_idx'))).toBe(true);
    expect(joined).not.toMatch(/TEMP B-TREE/i);
    expect(joined).not.toMatch(/SCAN workout_sets(?!_)/i);
  });

  it('resolves the exact best-before-current aggregate through the same index without a temp sort', async () => {
    const plan = await explain(
      exactCohortAggregateQuery(EXERCISE_ID, REPS, CURRENT_ENDED_AT, CURRENT_WORKOUT_ID),
    );
    const joined = plan.join('\n');

    expect(plan.some((line) => line.includes('workout_sets_external_pr_cohort_idx'))).toBe(true);
    expect(joined).not.toMatch(/TEMP B-TREE/i);
    expect(joined).not.toMatch(/SCAN workout_sets(?!_)/i);
  });

  it('resolves the bounded exact-exercise history page through owner and set indexes without a temp sort', async () => {
    const plan = await explain(boundedHistoryPageQuery());
    const joined = plan.join('\n');

    expect(plan.some((line) => line.includes('workouts_user_id_ended_at_idx'))).toBe(true);
    expect(plan.some((line) => line.includes('workout_sets'))).toBe(true);
    expect(joined).not.toMatch(/TEMP B-TREE/i);
  });

  it('orders by decimal-exact weight, selecting 100 over 99.9, 9.9, 1.1 and 1.01', async () => {
    const row = await db
      .select({ weightKg: workoutSets.weightKg })
      .from(workoutSets)
      .where(
        and(
          eq(workoutSets.exerciseId, ORDER_EXERCISE_ID),
          eq(workoutSets.loadMode, 'external'),
          eq(workoutSets.amountBasis, 'total'),
          eq(workoutSets.side, 'bilateral'),
          eq(workoutSets.reps, ORDER_REPS),
          eq(workoutSets.setPurpose, 'working'),
          isNull(workoutSets.deletedAt),
          eq(workoutSets.completed, true),
        ),
      )
      .orderBy(WEIGHT_INTEGER_LENGTH_DESC, WEIGHT_INTEGER_PART_DESC, WEIGHT_FRACTION_PART_DESC)
      .limit(1);

    expect(row[0]?.weightKg).toBe('100');
  });
});
