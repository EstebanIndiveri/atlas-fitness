import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import {
  exercises,
  routineExercises,
  routines,
  scheduledRoutines,
  trainingPlans,
} from '@/lib/db/schema';
import type { TrainingPlanReplacementState } from '@/types/training-plan-replacement-state';
import type { TrainingPlanHubDto } from '@/types/training-plan-hub';
import { AppError } from '@/types/errors';

export interface LoadedTrainingPlanReplacementState {
  planId: number;
  userId: number;
  isActive: boolean;
  updatedAt: string;
  replacementState: TrainingPlanReplacementState;
}

/**
 * Loads the persisted plan header and assignments that replacement must compare inside its write transaction.
 *
 * @param userId - Authenticated plan owner.
 * @param planId - Selected persisted plan.
 * @returns Exact header version and ordered assignment state.
 * @throws {AppError} NOT_FOUND when the plan is missing, deleted, or not owned by the user.
 */
export async function loadTrainingPlanReplacementState(
  userId: number,
  planId: number,
): Promise<LoadedTrainingPlanReplacementState> {
  const [plan] = await db
    .select({
      id: trainingPlans.id,
      userId: trainingPlans.userId,
      name: trainingPlans.name,
      goal: trainingPlans.goal,
      isActive: trainingPlans.isActive,
      updatedAt: trainingPlans.updatedAt,
    })
    .from(trainingPlans)
    .where(
      and(
        eq(trainingPlans.id, planId),
        eq(trainingPlans.userId, userId),
        isNull(trainingPlans.deletedAt),
      ),
    )
    .limit(1);
  if (!plan) {
    throw new AppError('NOT_FOUND', 'Plan no encontrado');
  }

  const scheduleRows = await db
    .select({
      dayOfWeek: scheduledRoutines.dayOfWeek,
      routineId: scheduledRoutines.routineId,
      note: scheduledRoutines.note,
    })
    .from(scheduledRoutines)
    .where(eq(scheduledRoutines.trainingPlanId, planId))
    .orderBy(asc(scheduledRoutines.dayOfWeek));
  const schedule = scheduleRows.map((entry) => {
    const dayOfWeek = entry.dayOfWeek;
    if (!isTrainingPlanDayOfWeek(dayOfWeek)) {
      throw new AppError('CONFLICT', 'El plan guardado tiene un día inválido.');
    }
    return { dayOfWeek, routineId: entry.routineId, note: entry.note };
  });
  const routineIds = [...new Set(schedule.map(({ routineId }) => routineId))].sort(
    (left, right) => left - right,
  );
  const routineRows = routineIds.length > 0
    ? await db
        .select({
          id: routines.id,
          slug: routines.slug,
          name: routines.name,
          description: routines.description,
          kind: routines.kind,
          restSeconds: routines.restSeconds,
          isSystem: routines.isSystem,
          userId: routines.userId,
          deletedAt: routines.deletedAt,
        })
        .from(routines)
        .where(inArray(routines.id, routineIds))
        .orderBy(asc(routines.id))
    : [];
  const routineExerciseRows = routineIds.length > 0
    ? await db
        .select({
          routineId: routineExercises.routineId,
          exerciseId: routineExercises.exerciseId,
          sortOrder: routineExercises.sortOrder,
          targetSets: routineExercises.targetSets,
          targetReps: routineExercises.targetReps,
          isSystem: exercises.isSystem,
          userId: exercises.userId,
          exerciseName: exercises.name,
          muscleGroup: exercises.muscleGroup,
          instructions: exercises.instructions,
          imageUrl: exercises.imageUrl,
          videoUrl: exercises.videoUrl,
        })
        .from(routineExercises)
        .innerJoin(exercises, eq(routineExercises.exerciseId, exercises.id))
        .where(and(inArray(routineExercises.routineId, routineIds), isNull(exercises.deletedAt)))
        .orderBy(
          asc(routineExercises.routineId),
          asc(routineExercises.sortOrder),
          asc(routineExercises.exerciseId),
        )
    : [];
  const exercisesByRoutineId = new Map<number, TrainingPlanReplacementState['routines'][number]['exercises']>();
  for (const exercise of routineExerciseRows) {
    const items = exercisesByRoutineId.get(exercise.routineId) ?? [];
    items.push({
      exerciseId: exercise.exerciseId,
      sortOrder: exercise.sortOrder,
      targetSets: exercise.targetSets,
      targetReps: exercise.targetReps,
      isSystem: exercise.isSystem,
      userId: exercise.userId,
      exerciseName: exercise.exerciseName,
      muscleGroup: exercise.muscleGroup,
      instructions: exercise.instructions,
      imageUrl: exercise.imageUrl,
      videoUrl: exercise.videoUrl,
    });
    exercisesByRoutineId.set(exercise.routineId, items);
  }
  if (routineRows.length !== routineIds.length) {
    throw new AppError('CONFLICT', 'El plan contiene una rutina que ya no está disponible.');
  }
  const routineState = routineRows.map((routine) => ({
    id: routine.id,
    slug: routine.slug,
    name: routine.name,
    description: routine.description,
    kind: parseRoutineKind(routine.kind),
    restSeconds: routine.restSeconds,
    isSystem: routine.isSystem,
    userId: routine.userId,
    deletedAt: routine.deletedAt?.toISOString() ?? null,
    exercises: exercisesByRoutineId.get(routine.id) ?? [],
  }));

  return {
    planId: plan.id,
    userId: plan.userId,
    isActive: plan.isActive,
    updatedAt: plan.updatedAt.toISOString(),
    replacementState: {
      name: plan.name,
      goal: plan.goal,
      schedule,
      routines: routineState,
    },
  };
}

function isTrainingPlanDayOfWeek(value: number): value is 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

function parseRoutineKind(value: string): 'gym' | 'home' {
  if (value !== 'gym' && value !== 'home') {
    throw new AppError('CONFLICT', 'El plan contiene una rutina con un tipo inválido.');
  }
  return value;
}

/**
 * Verifies that the joined current-plan read and raw assignment snapshot describe the same persisted version.
 *
 * @param hub - Server-authored seven-day plan view.
 * @param source - Persisted plan header and assignments read for atomic replacement.
 * @returns Nothing when both read models agree.
 * @throws {AppError} CONFLICT when a concurrent edit separated the two reads.
 */
export function assertTrainingPlanReplacementStateMatchesHub(
  hub: TrainingPlanHubDto,
  source: LoadedTrainingPlanReplacementState,
): void {
  if (
    hub.plan.id !== source.planId
    || hub.plan.name !== source.replacementState.name
    || hub.plan.goal !== source.replacementState.goal
    || hub.plan.isActive !== source.isActive
    || hub.plan.updatedAt !== source.updatedAt
  ) {
    throw new AppError('CONFLICT', 'El plan cambió al preparar la propuesta. Volvé a intentarlo.');
  }

  const assignments = new Map(
    source.replacementState.schedule.map((entry) => [entry.dayOfWeek, entry]),
  );
  const daysMatch = hub.days.every(({ dayOfWeek, assignment }) => {
    const persisted = assignments.get(dayOfWeek);
    if (assignment.kind === 'rest') {
      return persisted === undefined;
    }
    if (!persisted) {
      return false;
    }
    return assignment.kind !== 'routine'
      || (assignment.routineId === persisted.routineId && assignment.focus === persisted.note);
  });

  if (!daysMatch || assignments.size !== source.replacementState.schedule.length) {
    throw new AppError('CONFLICT', 'El plan cambió al preparar la propuesta. Volvé a intentarlo.');
  }
}
