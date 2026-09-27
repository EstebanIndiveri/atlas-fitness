import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { exercises, routineExercises, routines, scheduledRoutines, trainingPlans } from '@/lib/db/schema';
import { hashTrainingPlanImprovementValue } from '@/lib/services/training-plan-improvement-hash';
import type { TrainingPlanReplacementState } from '@/types/training-plan-replacement-state';
import { AppError } from '@/types/errors';

async function loadAssignedRoutineState(
  tx: Pick<typeof db, 'select'>,
  routineIds: number[],
): Promise<TrainingPlanReplacementState['routines']> {
  const orderedRoutineIds = [...new Set(routineIds)].sort((left, right) => left - right);
  if (orderedRoutineIds.length === 0) {
    return [];
  }

  const routineRows = await tx
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
    .where(inArray(routines.id, orderedRoutineIds))
    .orderBy(asc(routines.id));
  const exerciseRows = await tx
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
    .where(and(inArray(routineExercises.routineId, orderedRoutineIds), isNull(exercises.deletedAt)))
    .orderBy(
      asc(routineExercises.routineId),
      asc(routineExercises.sortOrder),
      asc(routineExercises.exerciseId),
    );
  const exercisesByRoutineId = new Map<
    number,
    TrainingPlanReplacementState['routines'][number]['exercises']
  >();
  for (const exercise of exerciseRows) {
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

  if (routineRows.length !== orderedRoutineIds.length) {
    throw new AppError('CONFLICT', 'El plan contiene una rutina que ya no está disponible.');
  }

  return routineRows.map((routine) => ({
    id: routine.id,
    slug: routine.slug,
    name: routine.name,
    description: routine.description,
    kind: normalizeRoutineKind(routine.kind),
    restSeconds: routine.restSeconds,
    isSystem: routine.isSystem,
    userId: routine.userId,
    deletedAt: routine.deletedAt?.toISOString() ?? null,
    exercises: exercisesByRoutineId.get(routine.id) ?? [],
  }));
}

function normalizeRoutineKind(value: string): 'gym' | 'home' {
  if (value !== 'gym' && value !== 'home') {
    throw new AppError('CONFLICT', 'Una rutina asignada cambió desde que se generó la propuesta.');
  }
  return value;
}

function isTrainingPlanDayOfWeek(value: number): value is 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

/**
 * Verifies the exact owned plan version and assigned routine state inside the caller's write transaction.
 *
 * @param tx - Active database transaction used for the subsequent lifecycle transition.
 * @param userId - Authenticated plan owner.
 * @param planId - Expected persisted plan id.
 * @param expectedUpdatedAt - Header version captured with the user's confirmation.
 * @param expectedStateHash - Hash of the assigned plan and routine state captured with confirmation.
 * @param expectedActive - Expected active state before or after the transition.
 * @returns Nothing when the persisted plan still matches the confirmed state.
 * @throws {AppError} CONFLICT when the plan or any assigned routine changed.
 */
export async function assertTrainingPlanTransactionState(
  tx: Pick<typeof db, 'select'>,
  userId: number,
  planId: number,
  expectedUpdatedAt: Date,
  expectedStateHash: string,
  expectedActive: boolean,
): Promise<void> {
  const [currentPlan] = await tx
    .select({
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
  if (
    !currentPlan
    || currentPlan.isActive !== expectedActive
    || currentPlan.updatedAt.getTime() !== expectedUpdatedAt.getTime()
  ) {
    throw new AppError('CONFLICT', 'El plan cambió desde que se generó la propuesta. Generá una nueva.');
  }

  const scheduleRows = await tx
    .select({
      dayOfWeek: scheduledRoutines.dayOfWeek,
      routineId: scheduledRoutines.routineId,
      note: scheduledRoutines.note,
    })
    .from(scheduledRoutines)
    .where(eq(scheduledRoutines.trainingPlanId, planId))
    .orderBy(asc(scheduledRoutines.dayOfWeek));
  const schedule = scheduleRows.map(({ dayOfWeek, routineId, note }) => {
    if (!isTrainingPlanDayOfWeek(dayOfWeek)) {
      throw new AppError('CONFLICT', 'El plan contiene un día inválido.');
    }
    return { dayOfWeek, routineId, note };
  });
  const routinesState = await loadAssignedRoutineState(
    tx,
    schedule.map(({ routineId }) => routineId),
  );
  const state: TrainingPlanReplacementState = {
    name: currentPlan.name,
    goal: currentPlan.goal,
    schedule,
    routines: routinesState,
  };
  if (hashTrainingPlanImprovementValue(state) !== expectedStateHash) {
    throw new AppError('CONFLICT', 'El plan cambió desde que se generó la propuesta. Generá una nueva.');
  }
}
