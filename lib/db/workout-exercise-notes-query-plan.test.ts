import { beforeAll, describe, expect, it } from '@jest/globals';
import { and, desc, eq, exists, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import {
  exercises,
  users,
  workoutExerciseNotes,
  workouts,
  workoutSets,
} from '@/lib/db/schema';

/**
 * v0.11 Workstream B query-plan gate.
 *
 * The approved scalability claim is that both bounded historical lookups resolve the
 * latest eligible workout through the additive partial index
 * `workouts_user_id_ended_at_idx` and then reach the per-exercise rows through an added
 * index, without scanning the full history and without a temp B-tree sort.
 *
 * These queries mirror `lib/services/exercise-session-memory.ts` exactly. If SQLite ever
 * stops choosing the indexed plan, this suite fails instead of silently dropping the
 * claim.
 */

const USER_ID = 9001;
const EXERCISE_ID = 9001;
const CURRENT_WORKOUT_ID = 999_999;

/** Latest completed workout (owned, non-deleted) that contains an eligible set. */
function latestEligibleSetsWorkoutQuery(): SQL {
  return db
    .select({ id: workouts.id, endedAt: workouts.endedAt })
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, USER_ID),
        isNull(workouts.deletedAt),
        isNotNull(workouts.endedAt),
        ne(workouts.id, CURRENT_WORKOUT_ID),
        exists(
          db
            .select({ one: sql`1` })
            .from(workoutSets)
            .where(
              and(
                eq(workoutSets.exerciseId, EXERCISE_ID),
                eq(workoutSets.workoutId, workouts.id),
                isNull(workoutSets.deletedAt),
                eq(workoutSets.completed, true),
              ),
            ),
        ),
      ),
    )
    .orderBy(desc(workouts.endedAt), desc(workouts.id))
    .limit(1)
    .getSQL();
}

/** Latest completed workout (owned, non-deleted) that contains a note. */
function latestEligibleNoteWorkoutQuery(): SQL {
  return db
    .select({ id: workouts.id, endedAt: workouts.endedAt })
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, USER_ID),
        isNull(workouts.deletedAt),
        isNotNull(workouts.endedAt),
        ne(workouts.id, CURRENT_WORKOUT_ID),
        exists(
          db
            .select({ one: sql`1` })
            .from(workoutExerciseNotes)
            .where(
              and(
                eq(workoutExerciseNotes.userId, USER_ID),
                eq(workoutExerciseNotes.exerciseId, EXERCISE_ID),
                eq(workoutExerciseNotes.workoutId, workouts.id),
              ),
            ),
        ),
      ),
    )
    .orderBy(desc(workouts.endedAt), desc(workouts.id))
    .limit(1)
    .getSQL();
}

async function explain(query: SQL): Promise<string[]> {
  const rows = await db.all<{ detail: string }>(sql`EXPLAIN QUERY PLAN ${query}`);
  return rows.map((row) => row.detail);
}

describe('exercise-session memory query plan gate', () => {
  beforeAll(async () => {
    await seed();
  });

  async function seed(): Promise<void> {
    await db.insert(users).values({
      id: USER_ID,
      name: 'Plan User',
      email: 'plan-user@example.com',
      passwordHash: 'hash',
    });
    await db.insert(exercises).values({
      id: EXERCISE_ID,
      slug: 'plan-exercise',
      name: 'Plan Exercise',
      muscleGroup: 'Pecho',
      instructions: 'x',
      isSystem: true,
    });
    await db.insert(exercises).values({
      id: EXERCISE_ID + 1,
      slug: 'plan-exercise-other',
      name: 'Plan Exercise Other',
      muscleGroup: 'Pecho',
      instructions: 'x',
      isSystem: true,
    });

    // 80 completed workouts for the user; only a handful match the exercise.
    for (let i = 1; i <= 80; i += 1) {
      await db.insert(workouts).values({
        id: 1_000 + i,
        userId: USER_ID,
        startedAt: new Date((1_700_000_000 + i) * 1000),
        endedAt: new Date((1_700_000_000 + i) * 1000),
      });
    }

    // Exercise sets every 10th workout; unrelated sets everywhere else.
    for (let i = 1; i <= 80; i += 1) {
      await db.insert(workoutSets).values({
        workoutId: 1_000 + i,
        exerciseId: i % 10 === 0 ? EXERCISE_ID : EXERCISE_ID + 1,
        setIndex: 1,
        reps: 8,
        weightKg: '60',
        completed: true,
      });
    }

    for (let i = 1; i <= 80; i += 1) {
      if (i % 8 === 0) {
        await db.insert(workoutExerciseNotes).values({
          userId: USER_ID,
          workoutId: 1_000 + i,
          exerciseId: EXERCISE_ID,
          note: `note-${i}`,
          version: 1,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        });
      }
    }
  }

  it('resolves the latest eligible sets through the additive indexes without a full scan or temp sort', async () => {
    const plan = await explain(latestEligibleSetsWorkoutQuery());
    const joined = plan.join('\n');

    expect(plan.some((line) => line.includes('workouts_user_id_ended_at_idx'))).toBe(true);
    expect(plan.some((line) => line.includes('workout_sets_exercise_lookup_idx'))).toBe(true);
    expect(joined).not.toMatch(/TEMP B-TREE/i);
  });

  it('resolves the latest eligible note through the additive indexes without a full scan or temp sort', async () => {
    const plan = await explain(latestEligibleNoteWorkoutQuery());
    const joined = plan.join('\n');

    expect(plan.some((line) => line.includes('workouts_user_id_ended_at_idx'))).toBe(true);
    expect(plan.some((line) => line.includes('workout_exercise_notes'))).toBe(true);
    expect(joined).not.toMatch(/TEMP B-TREE/i);
  });
});
