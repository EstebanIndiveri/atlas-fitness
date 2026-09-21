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

interface CoachTextIntents {
  targetMinutes: number | null;
  fatigueOrLighter: boolean;
  noMachines: boolean;
}

interface CoachDeltaFacts {
  accessoryTrimmed: boolean;
  mainReduced: boolean;
}

/**
 * Builds an explainable, local Coach Atlas adaptation without network or DB access.
 * Visible time is derived only from input set counts using ESTIMATED_MINUTES_PER_SET.
 * Free-text requests are interpreted locally for time-box, lighter/fatigue, and no-equipment intents.
 *
 * @param context Routine summary plus user-reported energy, mood, and optional request.
 * @returns A deterministic recommendation preview with original/adapted summaries and deltas.
 * @example
 * adaptDeterministically({ routine: { exercises: [{ exerciseId: 1, name: 'Sentadilla', sets: 4, category: 'compound' }] }, energy: 'high', mood: 4 })
 */
export function adaptDeterministically(context: CoachAdaptationContext): CoachAdaptationResult {
  const original = summarize(context.routine.exercises);
  const intents = detectTextIntents(context.freeText);
  const exerciseDeltas = selectDeltas(context.routine.exercises, context.energy, intents);
  const adapted = summarizeDeltas(exerciseDeltas);

  return {
    original,
    adapted,
    exerciseDeltas,
    reason: buildReason(
      context.routine.exercises,
      context.energy,
      intents,
      original,
      adapted,
      exerciseDeltas,
    ),
    source: 'deterministic',
  };
}

function selectDeltas(
  exercises: readonly CoachRoutineExerciseSummary[],
  energy: CoachAdaptationContext['energy'],
  intents: CoachTextIntents,
): CoachExerciseDelta[] {
  const candidates: CoachExerciseDelta[][] = [keepAllDeltas(exercises)];

  if (energy === 'low' || intents.fatigueOrLighter || intents.noMachines) {
    candidates.push(buildLowEnergyDeltas(exercises));
  }

  if (intents.targetMinutes !== null) {
    candidates.push(buildTimeBoxDeltas(exercises, intents.targetMinutes));
  }

  return candidates.reduce((best, candidate) => {
    const bestSummary = summarizeDeltas(best);
    const candidateSummary = summarizeDeltas(candidate);
    return candidateSummary.setCount < bestSummary.setCount ? candidate : best;
  });
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

function buildTimeBoxDeltas(
  exercises: readonly CoachRoutineExerciseSummary[],
  targetMinutes: number,
): CoachExerciseDelta[] {
  const deltas = keepAllDeltas(exercises);
  const maxSets = Math.max(0, Math.floor(targetMinutes / ESTIMATED_MINUTES_PER_SET));
  let remainingReduction = Math.max(0, summarizeDeltas(deltas).setCount - maxSets);

  for (let index = exercises.length - 1; index >= 0 && remainingReduction > 0; index -= 1) {
    if (isMainMovement(exercises[index], index)) {
      continue;
    }
    remainingReduction -= trimAccessoryDelta(deltas[index], remainingReduction);
  }

  for (let index = exercises.length - 1; index >= 0 && remainingReduction > 0; index -= 1) {
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
  exercises: readonly CoachRoutineExerciseSummary[],
  energy: CoachAdaptationContext['energy'],
  intents: CoachTextIntents,
  original: CoachRoutineSummary,
  adapted: CoachRoutineSummary,
  deltas: readonly CoachExerciseDelta[],
): string {
  const facts = buildDeltaFacts(exercises, deltas);

  if (adapted.setCount >= original.setCount) {
    return 'Sin cambios: tu energía registrada permite mantener la rutina original. Podés previsualizar y aceptar o rechazar.';
  }

  if (intents.targetMinutes !== null && original.estMinutes > intents.targetMinutes && energy === 'low') {
    return buildTimeBoxReason(intents.targetMinutes, facts, ' y por tu energía baja');
  }

  if (intents.targetMinutes !== null && original.estMinutes > intents.targetMinutes) {
    return buildTimeBoxReason(intents.targetMinutes, facts, '');
  }

  if (intents.noMachines) {
    if (energy === 'low') {
      if (facts.mainReduced) {
        return 'Compactamos volumen porque registraste energía baja y no tenés máquinas o equipo disponible: también bajamos algunas series principales para mantenerlo realizable.';
      }
      return 'Compactamos volumen de accesorios porque registraste energía baja y no tenés máquinas o equipo disponible, sin inventar cambios de ejercicios.';
    }
    if (facts.mainReduced) {
      return 'Compactamos volumen porque no tenés máquinas o equipo disponible: bajamos algunas series principales sin inventar cambios de ejercicios.';
    }
    return 'Compactamos volumen de accesorios porque no tenés máquinas o equipo disponible: mantenemos los principales sin inventar cambios de ejercicios.';
  }

  if (intents.fatigueOrLighter) {
    if (energy === 'low') {
      if (facts.mainReduced) {
        return 'Bajamos volumen porque registraste energía baja y pediste algo más liviano: también redujimos algunas series principales.';
      }
      return 'Bajamos volumen porque registraste energía baja y pediste algo más liviano: mantenemos los principales y recortamos accesorios.';
    }
    if (facts.mainReduced) {
      return 'Bajamos volumen porque pediste algo más liviano: también redujimos algunas series principales.';
    }
    return 'Bajamos volumen porque pediste algo más liviano: mantenemos los principales y recortamos accesorios.';
  }

  if (energy === 'low') {
    if (facts.mainReduced) {
      return 'Bajamos volumen porque registraste energía baja: también redujimos algunas series principales para ajustar la sesión.';
    }
    return 'Bajamos volumen porque registraste energía baja: mantenemos los movimientos principales y recortamos accesorios. Podés previsualizar y aceptar o rechazar.';
  }

  return 'Sin cambios: tu energía registrada permite mantener la rutina original. Podés previsualizar y aceptar o rechazar.';
}

function buildTimeBoxReason(targetMinutes: number, facts: CoachDeltaFacts, suffix: string): string {
  if (facts.accessoryTrimmed && facts.mainReduced) {
    return `Ajustamos la sesión para que entre en ~${targetMinutes} min${suffix}: recortamos accesorios y bajamos algunas series de los principales para respetar tu tiempo.`;
  }

  if (facts.mainReduced) {
    return `Ajustamos la sesión para que entre en ~${targetMinutes} min${suffix}: bajamos series de los movimientos principales para respetar tu tiempo.`;
  }

  if (facts.accessoryTrimmed) {
    return `Ajustamos la sesión para que entre en ~${targetMinutes} min${suffix}: mantenemos los movimientos principales y recortamos accesorios.`;
  }

  return 'Sin cambios: tu energía registrada permite mantener la rutina original. Podés previsualizar y aceptar o rechazar.';
}

function buildDeltaFacts(
  exercises: readonly CoachRoutineExerciseSummary[],
  deltas: readonly CoachExerciseDelta[],
): CoachDeltaFacts {
  return deltas.reduce<CoachDeltaFacts>(
    (facts, item, index) => {
      if (item.toSets >= item.fromSets) {
        return facts;
      }

      if (isMainMovement(exercises[index], index)) {
        return { ...facts, mainReduced: true };
      }

      return { ...facts, accessoryTrimmed: true };
    },
    { accessoryTrimmed: false, mainReduced: false },
  );
}

function detectTextIntents(freeText: string | undefined): CoachTextIntents {
  const normalized = normalizeFreeText(freeText);
  return {
    targetMinutes: detectTargetMinutes(normalized),
    fatigueOrLighter: /cansad|livian|suave|liger|poca energia|sin ganas|agotad/.test(normalized),
    noMachines: /sin maquina|sin maquinas|sin equipo|en casa/.test(normalized),
  };
}

function detectTargetMinutes(normalized: string): number | null {
  if (normalized.length === 0) {
    return null;
  }

  if (/\bmedia hora\b/.test(normalized)) {
    return 30;
  }

  if (/\b(?:una|1)\s+hora\b/.test(normalized)) {
    return 60;
  }

  const minuteMatch = normalized.match(/\b(\d{1,3})\s*(?:min|mins|minuto|minutos)\b/);
  if (!minuteMatch) {
    return null;
  }

  const minutes = Number.parseInt(minuteMatch[1], 10);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

function normalizeFreeText(freeText: string | undefined): string {
  return (freeText ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-AR');
}

function normalizeSetCount(sets: number): number {
  return Math.max(0, Math.floor(sets));
}
