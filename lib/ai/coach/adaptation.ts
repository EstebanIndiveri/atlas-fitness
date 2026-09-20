import { z } from 'zod';

import type {
  CoachAdaptationContext,
  CoachAdaptationResult,
  CoachExerciseDelta,
  CoachRoutineExerciseSummary,
  CoachRoutineSummary,
} from '@/types/coach';

export const ESTIMATED_MINUTES_PER_SET = 3;

const coachGeminiChangeBase = {
  queueItemId: z.string().min(1),
  reason: z.string().min(1).max(180),
};

export const coachGeminiOutputSchema = z.object({
  reason: z.string().min(1).max(360),
  suggestedChanges: z
    .array(
      z.discriminatedUnion('kind', [
        z.object({ ...coachGeminiChangeBase, kind: z.literal('remove_exercise') }).strict(),
        z
          .object({
            ...coachGeminiChangeBase,
            kind: z.literal('reduce_sets'),
            targetSets: z.number().int().min(1).max(10),
          })
          .strict(),
        z
          .object({
            ...coachGeminiChangeBase,
            kind: z.literal('reduce_reps'),
            targetReps: z.number().int().min(1).max(50),
          })
          .strict(),
        z.object({ ...coachGeminiChangeBase, kind: z.literal('keep_exercise') }).strict(),
        z
          .object({
            ...coachGeminiChangeBase,
            kind: z.literal('reorder_exercise'),
            sortOrder: z.number().int().min(0),
          })
          .strict(),
      ]),
    )
    .min(1),
});

export type CoachGeminiOutput = z.infer<typeof coachGeminiOutputSchema>;

const coachRoutineSummarySchema = z.object({
  exerciseCount: z.number().int().min(0),
  setCount: z.number().int().min(0),
  estMinutes: z.number().int().min(0),
});

const coachExerciseDeltaSchema = z.object({
  exerciseId: z.number().int().positive(),
  name: z.string().min(1),
  action: z.enum(['kept', 'reduced', 'removed']),
  fromSets: z.number().int().min(0),
  toSets: z.number().int().min(0),
});

export const coachAdaptationResultSchema = z.object({
  original: coachRoutineSummarySchema,
  adapted: coachRoutineSummarySchema,
  exerciseDeltas: z.array(coachExerciseDeltaSchema),
  reason: z.string().min(1).max(360),
  source: z.enum(['deterministic', 'ai']),
});

export const coachAiAdaptationResultSchema = coachAdaptationResultSchema.extend({
  source: z.literal('ai'),
});

export type CoachAiAdaptationResult = z.infer<typeof coachAiAdaptationResultSchema>;

/**
 * Builds an explainable, local Coach Atlas adaptation without network or DB access.
 * Visible time is derived only from input set counts using ESTIMATED_MINUTES_PER_SET.
 *
 * @param context Routine summary plus user-reported energy, mood, and optional request.
 * @returns A deterministic recommendation preview with original/adapted summaries and deltas.
 * @example
 * adaptDeterministically({ routine: { exercises: [{ exerciseId: 1, name: 'Sentadilla', sets: 4, category: 'compound' }] }, energy: 'high', mood: 4 })
 */
export function adaptDeterministically(context: CoachAdaptationContext): CoachAdaptationResult {
  const original = summarize(context.routine.exercises);
  const exerciseDeltas =
    context.energy === 'low'
      ? buildLowEnergyDeltas(context.routine.exercises)
      : keepAllDeltas(context.routine.exercises);
  const adapted = summarizeDeltas(exerciseDeltas);

  return {
    original,
    adapted,
    exerciseDeltas,
    reason: buildReason(context.energy, original, adapted),
    source: 'deterministic',
  };
}

function buildLowEnergyDeltas(exercises: readonly CoachRoutineExerciseSummary[]): CoachExerciseDelta[] {
  const deltas = exercises.map((exercise) => {
    const fromSets = normalizeSetCount(exercise.sets);
    return delta(exercise, 'kept', fromSets, fromSets);
  });
  let remainingReduction = Math.round(deltas.reduce((total, item) => total + item.fromSets, 0) * 0.3);

  for (let index = exercises.length - 1; index >= 0 && remainingReduction > 0; index -= 1) {
    if (isMainMovement(exercises[index], index)) {
      continue;
    }
    remainingReduction -= trimAccessoryDelta(deltas[index], remainingReduction);
  }

  for (let index = exercises.length - 1; index >= 0 && remainingReduction > 0; index -= 1) {
    if (isMainMovement(exercises[index], index)) {
      continue;
    }
    remainingReduction -= reduceSetsWithoutRemoving(deltas[index], remainingReduction);
  }

  return deltas;
}

function keepAllDeltas(exercises: readonly CoachRoutineExerciseSummary[]): CoachExerciseDelta[] {
  return exercises.map((exercise) => {
    const sets = normalizeSetCount(exercise.sets);
    return delta(exercise, 'kept', sets, sets);
  });
}

function summarize(exercises: readonly CoachRoutineExerciseSummary[]): CoachRoutineSummary {
  const setCount = exercises.reduce((total, exercise) => total + normalizeSetCount(exercise.sets), 0);
  return {
    exerciseCount: exercises.length,
    setCount,
    estMinutes: setCount * ESTIMATED_MINUTES_PER_SET,
  };
}

function summarizeDeltas(deltas: readonly CoachExerciseDelta[]): CoachRoutineSummary {
  const setCount = deltas.reduce((total, item) => total + item.toSets, 0);
  return {
    exerciseCount: deltas.filter((item) => item.toSets > 0).length,
    setCount,
    estMinutes: setCount * ESTIMATED_MINUTES_PER_SET,
  };
}

function isMainMovement(exercise: CoachRoutineExerciseSummary, index: number): boolean {
  if (exercise.isCompound === true || exercise.category === 'compound') {
    return true;
  }
  if (exercise.category === 'accessory' || exercise.isCompound === false) {
    return false;
  }
  return index < 2;
}

function delta(
  exercise: CoachRoutineExerciseSummary,
  action: CoachExerciseDelta['action'],
  fromSets: number,
  toSets: number,
): CoachExerciseDelta {
  return {
    exerciseId: exercise.exerciseId,
    name: exercise.name,
    action,
    fromSets,
    toSets,
  };
}

function trimAccessoryDelta(item: CoachExerciseDelta, requestedReduction: number): number {
  if (item.fromSets <= 0) {
    return 0;
  }
  if (requestedReduction >= item.fromSets) {
    item.action = 'removed';
    item.toSets = 0;
    return item.fromSets;
  }
  return reduceSetsWithoutRemoving(item, requestedReduction);
}

function reduceSetsWithoutRemoving(item: CoachExerciseDelta, requestedReduction: number): number {
  const maxReduction = Math.max(0, item.toSets - 1);
  const actualReduction = Math.min(requestedReduction, maxReduction);
  if (actualReduction <= 0) {
    return 0;
  }
  item.toSets -= actualReduction;
  item.action = 'reduced';
  return actualReduction;
}

function buildReason(
  energy: CoachAdaptationContext['energy'],
  original: CoachRoutineSummary,
  adapted: CoachRoutineSummary,
): string {
  if (energy === 'low' && adapted.setCount < original.setCount) {
    return 'Bajamos volumen porque registraste energía baja: mantenemos los movimientos principales y recortamos accesorios. Podés previsualizar y aceptar o rechazar.';
  }

  return 'Sin cambios: tu energía registrada permite mantener la rutina original. Podés previsualizar y aceptar o rechazar.';
}

function normalizeSetCount(sets: number): number {
  return Math.max(0, Math.floor(sets));
}
