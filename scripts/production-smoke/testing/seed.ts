/**
 * Test-only DB helpers. Seeds a dedicated QA user (via the real auth service),
 * a system routine/exercise, and orphan artifacts for recovery tests.
 *
 * Only tests import this module; production code never does.
 */
import { db } from '@/lib/db/client';
import { and, eq, isNull } from 'drizzle-orm';
import {
  botMessages,
  coachRecommendations,
  dailyCheckins,
  exercises,
  guidedTrainingPlanSaves,
  habitLogs,
  habitTargetDays,
  habitTargetSchedules,
  postWorkoutFeedback,
  rateLimitBuckets,
  routineExercises,
  routines,
  scheduledRoutines,
  sessions,
  streakNudges,
  telegramLinkCodes,
  trainingPlans,
  userPreferences,
  users,
  userStreaks,
  workoutExerciseNotes,
  workoutQueueMutations,
  workouts,
  workoutSets,
} from '@/lib/db/schema';
import { register } from '@/lib/services/auth';

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Clears every table the runner tests can touch, in FK-safe order. */
export async function resetDatabase(): Promise<void> {
  await db.delete(habitTargetDays);
  await db.delete(habitTargetSchedules);
  await db.delete(habitLogs);
  await db.delete(streakNudges);
  await db.delete(coachRecommendations);
  await db.delete(scheduledRoutines);
  await db.delete(workoutQueueMutations);
  await db.delete(postWorkoutFeedback);
  await db.delete(workoutExerciseNotes);
  await db.delete(workoutSets);
  await db.delete(routineExercises);
  await db.delete(workouts);
  await db.delete(guidedTrainingPlanSaves);
  await db.delete(routines);
  await db.delete(trainingPlans);
  await db.delete(dailyCheckins);
  await db.delete(userStreaks);
  await db.delete(botMessages);
  await db.delete(telegramLinkCodes);
  await db.delete(sessions);
  await db.delete(rateLimitBuckets);
  await db.delete(userPreferences);
  await db.delete(exercises);
  await db.delete(users);
}

/** Creates a real, login-capable QA user via the app's auth service. */
export async function seedQaUser(email: string, password: string): Promise<number> {
  const user = await register({ name: 'Atlas Smoke QA', email, password });
  return user.id;
}

export interface SeededRoutine {
  routineId: number;
  exerciseId: number;
}

/** Seeds one system routine containing one system exercise. */
export async function seedSystemRoutineWithExercise(): Promise<SeededRoutine> {
  const suffix = randomSuffix();
  const [exercise] = await db
    .insert(exercises)
    .values({
      slug: `smoke-bench-${suffix}`,
      name: 'Smoke Bench',
      muscleGroup: 'Pecho',
      instructions: 'x',
      isSystem: true,
      userId: null,
    })
    .returning({ id: exercises.id });
  const [routine] = await db
    .insert(routines)
    .values({
      slug: `smoke-routine-${suffix}`,
      name: 'Smoke Routine',
      isSystem: true,
      userId: null,
    })
    .returning({ id: routines.id });
  await db.insert(routineExercises).values({
    routineId: routine!.id,
    exerciseId: exercise!.id,
    sortOrder: 1,
    targetSets: 3,
    targetReps: 10,
  });
  return { routineId: routine!.id, exerciseId: exercise!.id };
}

export interface SeedWorkoutInput {
  userId: number;
  routineId?: number | null;
  note?: string | null;
  startedAt?: Date;
  endedAt?: Date | null;
}

export async function seedWorkout(input: SeedWorkoutInput): Promise<number> {
  const [row] = await db
    .insert(workouts)
    .values({
      userId: input.userId,
      routineId: input.routineId ?? null,
      note: input.note ?? null,
      startedAt: input.startedAt ?? new Date(),
      endedAt: input.endedAt ?? null,
    })
    .returning({ id: workouts.id });
  return row!.id;
}

export interface SeedSetInput {
  workoutId: number;
  exerciseId: number;
  setIndex: number;
  reps: number;
  weightKg: string;
}

export async function seedSet(input: SeedSetInput): Promise<number> {
  const [row] = await db
    .insert(workoutSets)
    .values({ ...input, completed: true })
    .returning({ id: workoutSets.id });
  return row!.id;
}

export interface SeedNoteInput {
  userId: number;
  workoutId: number;
  exerciseId: number;
  note: string;
  version?: number;
}

export async function seedNote(input: SeedNoteInput): Promise<number> {
  const now = new Date();
  const [row] = await db
    .insert(workoutExerciseNotes)
    .values({
      userId: input.userId,
      workoutId: input.workoutId,
      exerciseId: input.exerciseId,
      note: input.note,
      version: input.version ?? 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: workoutExerciseNotes.id });
  return row!.id;
}

/** Reads the visible (non-deleted) workout ids for a user. */
export async function listVisibleWorkoutIds(userId: number): Promise<number[]> {
  const rows = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(and(eq(workouts.userId, userId), isNull(workouts.deletedAt)));
  return rows.map((row) => row.id);
}

/** Reads a single workout row (including soft-delete state) for assertions. */
export async function readWorkoutRow(workoutId: number) {
  const [row] = await db.select().from(workouts).where(eq(workouts.id, workoutId)).limit(1);
  return row;
}

/** Reads a single note row for assertions (or undefined). */
export async function readNoteRow(workoutId: number, exerciseId: number) {
  const [row] = await db
    .select()
    .from(workoutExerciseNotes)
    .where(
      and(
        eq(workoutExerciseNotes.workoutId, workoutId),
        eq(workoutExerciseNotes.exerciseId, exerciseId),
      ),
    )
    .limit(1);
  return row;
}
