import { z } from 'zod';

import {
  generateCoachAdaptation,
  type CoachGeminiAdaptationDeps,
} from '@/lib/ai/coach/gemini-adaptation';
import { getTodayCheckIn } from '@/lib/services/daily-checkin';
import { getRoutineById } from '@/lib/services/routines';
import { AppError } from '@/types/errors';
import type {
  CoachAdaptationContext,
  CoachAdaptationResult,
  CoachEnergyLevel,
} from '@/types/coach';

const PREVIEW_CONTEXT_MISSING =
  'Necesitás registrar tu check-in de hoy o indicar energía y ánimo para adaptar.';
const PREVIEW_INPUT_INVALID = 'Preview de Coach Atlas inválido';
const FREE_TEXT_MAX_LENGTH = 500;

const moodSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

const previewCoachAdaptationSchema = z.object({
  routineId: z.number().int().positive(),
  userId: z.number().int().positive(),
  energy: z.enum(['low', 'medium', 'high']).optional(),
  mood: moodSchema.optional(),
  freeText: z
    .string()
    .trim()
    .max(FREE_TEXT_MAX_LENGTH)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});

type PreviewCoachAdaptationInput = z.infer<typeof previewCoachAdaptationSchema>;

/**
 * Builds a read-only Coach Atlas adaptation preview from real user-provided or check-in data.
 *
 * @param input Unknown boundary payload containing routine id, user id, and optional energy, mood, and note.
 * @param deps Optional Gemini dependencies forwarded for deterministic tests or custom generation.
 * @returns An explainable original-vs-adapted routine preview without persisting anything.
 * @throws {AppError} VALIDATION when input is invalid or explicit/check-in data cannot provide both energy and mood.
 * @throws {AppError} NOT_FOUND when the routine is absent or inaccessible to the user.
 * @example
 * await previewCoachAdaptation({ routineId: 10, userId: 1, energy: 'low', mood: 2 });
 */
export async function previewCoachAdaptation(
  input: unknown,
  deps?: CoachGeminiAdaptationDeps,
): Promise<CoachAdaptationResult> {
  const validInput = parseInput(input);
  const routine = await getRoutineById(validInput.routineId, validInput.userId);
  const energyAndMood = await resolveEnergyAndMood(validInput);

  const context: CoachAdaptationContext = {
    routine: {
      exercises: routine.exercises.map((exercise) => ({
        exerciseId: exercise.exerciseId,
        name: exercise.exerciseName,
        sets: exercise.targetSets,
        muscleGroup: exercise.muscleGroup,
        sortOrder: exercise.sortOrder,
      })),
    },
    energy: energyAndMood.energy,
    mood: energyAndMood.mood,
    ...(validInput.freeText === undefined ? {} : { freeText: validInput.freeText }),
  };

  return generateCoachAdaptation(context, deps);
}

function parseInput(input: unknown): PreviewCoachAdaptationInput {
  const parsed = previewCoachAdaptationSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError('VALIDATION', PREVIEW_INPUT_INVALID);
  }
  return parsed.data;
}

async function resolveEnergyAndMood(
  input: PreviewCoachAdaptationInput,
): Promise<{ energy: CoachEnergyLevel; mood: CoachAdaptationContext['mood'] }> {
  let energy = input.energy;
  let mood = input.mood;

  if (energy === undefined || mood === undefined) {
    const checkIn = await getTodayCheckIn(input.userId);
    if (energy === undefined && isCoachEnergy(checkIn?.energy)) {
      energy = checkIn.energy;
    }
    if (mood === undefined && isCoachMood(checkIn?.mood)) {
      mood = checkIn.mood;
    }
  }

  if (energy === undefined || mood === undefined) {
    throw new AppError('VALIDATION', PREVIEW_CONTEXT_MISSING);
  }

  return { energy, mood };
}

function isCoachEnergy(value: unknown): value is CoachEnergyLevel {
  return value === 'low' || value === 'medium' || value === 'high';
}

function isCoachMood(value: unknown): value is CoachAdaptationContext['mood'] {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}
