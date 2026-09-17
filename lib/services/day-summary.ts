import { and, eq, isNull, or } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { exercises, workouts, workoutSets } from '@/lib/db/schema';
import { cordobaLocalDate } from '@/lib/time/cordoba';
import type { Workout, WorkoutSet } from '@/lib/db/schema';

export interface DaySummarySet {
  exerciseName: string;
  reps: number;
  weightKg: string;
}

export interface DaySummaryWorkout {
  id: number;
  endedAt: Date | null;
  sets: DaySummarySet[];
}

export interface DaySummary {
  localDate: string;
  workouts: DaySummaryWorkout[];
  setCount: number;
  hasOpenWorkout: boolean;
}

function isOnLocalDate(workout: Workout, localDate: string): boolean {
  if (cordobaLocalDate(workout.startedAt) === localDate) {
    return true;
  }
  return workout.endedAt !== null && cordobaLocalDate(workout.endedAt) === localDate;
}

export async function getDaySummary(
  userId: number,
  localDate: string
): Promise<DaySummary> {
  const userWorkouts = await db.query.workouts.findMany({
    where: and(eq(workouts.userId, userId), isNull(workouts.deletedAt)),
    orderBy: (workoutsTable, { asc }) => [asc(workoutsTable.startedAt)],
  });

  const todays = userWorkouts.filter((workout) => isOnLocalDate(workout, localDate));
  const summaries: DaySummaryWorkout[] = [];
  let setCount = 0;
  let hasOpenWorkout = false;

  for (const workout of todays) {
    if (!workout.endedAt) {
      hasOpenWorkout = true;
    }

    const sets = await db
      .select({
        exerciseName: exercises.name,
        reps: workoutSets.reps,
        weightKg: workoutSets.weightKg,
      })
      .from(workoutSets)
      .innerJoin(exercises, eq(exercises.id, workoutSets.exerciseId))
      .where(and(eq(workoutSets.workoutId, workout.id), isNull(workoutSets.deletedAt)))
      .orderBy(workoutSets.setIndex);

    setCount += sets.length;
    summaries.push({
      id: workout.id,
      endedAt: workout.endedAt,
      sets: sets.map((set) => ({
        exerciseName: set.exerciseName,
        reps: set.reps,
        weightKg: set.weightKg,
      })),
    });
  }

  return {
    localDate,
    workouts: summaries,
    setCount,
    hasOpenWorkout,
  };
}

export async function listCatalogExercises(userId: number) {
  return db.query.exercises.findMany({
    where: and(
      isNull(exercises.deletedAt),
      or(eq(exercises.isSystem, true), eq(exercises.userId, userId))
    ),
    orderBy: (table, { asc }) => [asc(table.name)],
  });
}

export function nextSetIndex(sets: Pick<WorkoutSet, 'setIndex'>[]): number {
  return sets.reduce((max, set) => Math.max(max, set.setIndex), 0) + 1;
}
