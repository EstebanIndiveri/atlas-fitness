import { beforeAll, describe, expect, it } from '@jest/globals';
import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { exercises, users, workouts, workoutSets } from '@/lib/db/schema';
import {
  boundedProgressionHistoryQuery,
  cohortCandidatesQuery,
} from '@/lib/db/progression-queries';
import type { ProgressionCohortFilters } from '@/lib/db/progression-queries';

/**
 * v0.12 Workstream D query-plan gate.
 *
 * Drives the SAME builders the service executes (no hand-mirrored SQL), so the
 * plan cannot drift from production:
 * 1. the exact all-time/best-before cohort candidates resolve through
 *    `workout_sets_external_pr_cohort_idx` (decimal-exact expressions);
 * 2. the bounded, keyset history page resolves through
 *    `workouts_user_id_ended_at_idx` plus a `workout_sets` index.
 * Neither may fall back to a temp B-tree sort or an unbounded scan.
 */

const USER_ID = 8101;
const EXERCISE_ID = 8101;
const REPS = 5;
const LIMIT = 11;
const CURRENT_ENDED_AT = new Date(1_730_000_000 * 1000);
const CURRENT_WORKOUT_ID = 9_000_001;

const filters: ProgressionCohortFilters = {
  exerciseId: EXERCISE_ID,
  userId: USER_ID,
  reps: REPS,
  amountBasis: 'total',
  side: 'bilateral',
};

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

  it('resolves the all-time cohort candidates through the expression index without a temp sort', async () => {
    const plan = await explain(cohortCandidatesQuery(filters).getSQL());
    const joined = plan.join('\n');
    expect(plan.some((line) => line.includes('workout_sets_external_pr_cohort_idx'))).toBe(true);
    expect(joined).not.toMatch(/TEMP B-TREE/i);
    expect(joined).not.toMatch(/SCAN workout_sets(?!_)/i);
  });

  it('resolves the best-before-current candidates through the same index without a temp sort', async () => {
    const plan = await explain(
      cohortCandidatesQuery(filters, {
        endedAt: CURRENT_ENDED_AT,
        workoutId: CURRENT_WORKOUT_ID,
      }).getSQL(),
    );
    const joined = plan.join('\n');
    expect(plan.some((line) => line.includes('workout_sets_external_pr_cohort_idx'))).toBe(true);
    expect(joined).not.toMatch(/TEMP B-TREE/i);
  });

  it('resolves the bounded history page through owner and set indexes without a temp sort', async () => {
    const plan = await explain(
      boundedProgressionHistoryQuery({ exerciseId: EXERCISE_ID, userId: USER_ID }, null, LIMIT).getSQL(),
    );
    const joined = plan.join('\n');
    expect(plan.some((line) => line.includes('workouts_user_id_ended_at_idx'))).toBe(true);
    expect(plan.some((line) => line.includes('workout_sets'))).toBe(true);
    expect(joined).not.toMatch(/TEMP B-TREE/i);
  });

  it('resolves a keyset history page through the owner index without a temp sort', async () => {
    const plan = await explain(
      boundedProgressionHistoryQuery({ exerciseId: EXERCISE_ID, userId: USER_ID }, {
        sortAt: CURRENT_ENDED_AT.toISOString(),
        workoutId: CURRENT_WORKOUT_ID,
        setIndex: 1,
        setId: 1,
      }, LIMIT).getSQL(),
    );
    const joined = plan.join('\n');
    expect(plan.some((line) => line.includes('workouts_user_id_ended_at_idx'))).toBe(true);
    expect(joined).not.toMatch(/TEMP B-TREE/i);
  });
});
