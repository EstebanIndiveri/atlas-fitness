import { beforeAll, describe, expect, it } from '@jest/globals';
import { and, asc, desc, eq, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { exercises, users, workouts, workoutSets } from '@/lib/db/schema';

/**
 * v0.12 Workstream D query-plan gate.
 *
 * The progression read model must resolve through the B indexes:
 * 1. the exact all-time/best-before cohort aggregate via
 *    `workout_sets_external_pr_cohort_idx` (decimal-exact expressions);
 * 2. the bounded, keyset exact-exercise history page via
 *    `workouts_user_id_ended_at_idx` plus a `workout_sets` index.
 * None may fall back to a temp B-tree sort or an unbounded scan.
 */

const USER_ID = 8101;
const EXERCISE_ID = 8101;
const REPS = 5;
const LIMIT = 11;
const CURRENT_ENDED_AT = new Date(1_730_000_000 * 1000);
const CURRENT_WORKOUT_ID = 9_000_001;

const WEIGHT_INTEGER_LENGTH_DESC = sql`(length(CASE WHEN instr(${workoutSets.weightKg}, '.') = 0 THEN ${workoutSets.weightKg} ELSE substr(${workoutSets.weightKg}, 1, instr(${workoutSets.weightKg}, '.') - 1) END)) DESC`;
const WEIGHT_INTEGER_PART_DESC = sql`(CASE WHEN instr(${workoutSets.weightKg}, '.') = 0 THEN ${workoutSets.weightKg} ELSE substr(${workoutSets.weightKg}, 1, instr(${workoutSets.weightKg}, '.') - 1) END) DESC`;
const WEIGHT_FRACTION_PART_DESC = sql`(CASE WHEN instr(${workoutSets.weightKg}, '.') = 0 THEN '' ELSE substr(${workoutSets.weightKg}, instr(${workoutSets.weightKg}, '.') + 1) END) DESC`;

/** Mirrors `loadCohortBest` in the service. */
function cohortBestQuery(withPrior: boolean): SQL {
  const eligibility = and(
    eq(workouts.userId, USER_ID),
    isNull(workouts.deletedAt),
    isNotNull(workouts.endedAt),
    withPrior
      ? or(
          lt(workouts.endedAt, CURRENT_ENDED_AT),
          and(eq(workouts.endedAt, CURRENT_ENDED_AT), lt(workouts.id, CURRENT_WORKOUT_ID)),
        )
      : undefined,
  );

  return db
    .select({ id: workoutSets.id })
    .from(workoutSets)
    .innerJoin(workouts, eq(workouts.id, workoutSets.workoutId))
    .where(
      and(
        eq(workoutSets.exerciseId, EXERCISE_ID),
        eq(workoutSets.loadMode, 'external'),
        eq(workoutSets.amountBasis, 'total'),
        eq(workoutSets.side, 'bilateral'),
        eq(workoutSets.reps, REPS),
        eq(workoutSets.setPurpose, 'working'),
        eq(workoutSets.completed, true),
        isNull(workoutSets.deletedAt),
        eligibility,
      ),
    )
    .orderBy(WEIGHT_INTEGER_LENGTH_DESC, WEIGHT_INTEGER_PART_DESC, WEIGHT_FRACTION_PART_DESC)
    .limit(1)
    .getSQL();
}

/** Mirrors `loadHistoryPage` in the service. */
function boundedHistoryQuery(): SQL {
  return db
    .select({ id: workoutSets.id })
    .from(workoutSets)
    .innerJoin(workouts, eq(workouts.id, workoutSets.workoutId))
    .where(
      and(
        eq(workoutSets.exerciseId, EXERCISE_ID),
        eq(workouts.userId, USER_ID),
        isNull(workouts.deletedAt),
        isNull(workoutSets.deletedAt),
        isNotNull(workouts.endedAt),
      ),
    )
    .orderBy(
      desc(workouts.endedAt),
      desc(workouts.id),
      asc(workoutSets.setIndex),
      asc(workoutSets.id),
    )
    .limit(LIMIT)
    .getSQL();
}

async function explain(query: SQL): Promise<string[]> {
  const rows = await db.all<{ detail: string }>(sql`EXPLAIN QUERY PLAN ${query}`);
  return rows.map((row) => row.detail);
}

describe('progression read model query plan gate', () => {
  beforeAll(async () => {
    await seed();
  });

  async function seed(): Promise<void> {
    await db.insert(users).values({
      id: USER_ID,
      name: 'Progression Plan User',
      email: 'progression-plan@example.com',
      passwordHash: 'hash',
    });
    await db.insert(exercises).values({
      id: EXERCISE_ID,
      slug: 'progression-plan-exercise',
      name: 'Progression Plan Exercise',
      muscleGroup: 'Pecho',
      instructions: 'x',
      isSystem: true,
    });

    const amounts = ['1.01', '1.1', '9.9', '10', '10.01', '100'];
    for (let i = 0; i < 40; i += 1) {
      const workoutId = 3_000 + i;
      await db.insert(workouts).values({
        id: workoutId,
        userId: USER_ID,
        startedAt: new Date((1_710_000_000 + i) * 1000),
        endedAt: new Date((1_710_000_000 + i) * 1000),
      });
      await db.insert(workoutSets).values({
        workoutId,
        exerciseId: EXERCISE_ID,
        setIndex: 1,
        reps: REPS,
        weightKg: amounts[i % amounts.length],
        completed: true,
        semanticCaptureVersion: 1,
        loadMode: 'external',
        amountBasis: 'total',
        side: 'bilateral',
        setPurpose: 'working',
      });
    }

    // Cross-user noise on the same exercise identity.
    for (let other = 1; other <= 4; other += 1) {
      const otherUserId = USER_ID + other;
      await db.insert(users).values({
        id: otherUserId,
        name: `Progression Noise ${other}`,
        email: `progression-noise-${other}@example.com`,
        passwordHash: 'hash',
      });
      for (let i = 0; i < 15; i += 1) {
        const workoutId = 4_000 + other * 100 + i;
        await db.insert(workouts).values({
          id: workoutId,
          userId: otherUserId,
          startedAt: new Date((1_711_000_000 + i) * 1000),
          endedAt: new Date((1_711_000_000 + i) * 1000),
        });
        await db.insert(workoutSets).values({
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
        });
      }
    }
  }

  it('resolves the all-time cohort aggregate through the expression index without a temp sort', async () => {
    const plan = await explain(cohortBestQuery(false));
    const joined = plan.join('\n');
    expect(plan.some((line) => line.includes('workout_sets_external_pr_cohort_idx'))).toBe(true);
    expect(joined).not.toMatch(/TEMP B-TREE/i);
    expect(joined).not.toMatch(/SCAN workout_sets(?!_)/i);
  });

  it('resolves the best-before-current aggregate through the same index without a temp sort', async () => {
    const plan = await explain(cohortBestQuery(true));
    const joined = plan.join('\n');
    expect(plan.some((line) => line.includes('workout_sets_external_pr_cohort_idx'))).toBe(true);
    expect(joined).not.toMatch(/TEMP B-TREE/i);
  });

  it('resolves the bounded history page through owner and set indexes without a temp sort', async () => {
    const plan = await explain(boundedHistoryQuery());
    const joined = plan.join('\n');
    expect(plan.some((line) => line.includes('workouts_user_id_ended_at_idx'))).toBe(true);
    expect(plan.some((line) => line.includes('workout_sets'))).toBe(true);
    expect(joined).not.toMatch(/TEMP B-TREE/i);
  });
});
