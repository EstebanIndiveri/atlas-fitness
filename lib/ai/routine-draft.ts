import { GEMINI_GENERATE_URL, GEMINI_TIMEOUT_MS, readGeminiApiKey } from '@/lib/ai/gemini';
import { AppError } from '@/types/errors';

import {
  buildRoutineFallback,
  exerciseCountForSession,
  getEligibleRoutineExercises,
  maxSetsForSession,
  normalizeRoutineDraftContext,
} from './routine-draft-selection';
import { parseGeminiObject, validateGeminiRoutineDraft } from './routine-draft-validation';
import type {
  RoutineDraft,
  RoutineDraftBrief,
  RoutineDraftContext,
  RoutineDraftDependencies,
} from './routine-draft-types';

export type {
  RoutineDraft,
  RoutineDraftBrief,
  RoutineDraftCatalogItem,
  RoutineDraftContext,
  RoutineDraftDependencies,
  RoutineDraftExercise,
  RoutineDraftLevel,
  RoutineDraftLocation,
  RoutineDraftSource,
} from './routine-draft-types';

type GeminiRequestResult =
  | { status: 'unavailable' }
  | { status: 'invalid'; reason: string }
  | { status: 'response'; value: unknown };

function buildPrompt(
  context: RoutineDraftContext,
  candidatePool: RoutineDraftContext['catalog'],
  repairReason?: string,
): string {
  const candidates = candidatePool.map((item) => ({
    id: item.id,
    name: item.name,
    muscleGroup: item.muscleGroup,
    instructions: item.instructions,
    ...(item.equipment ? { equipment: item.equipment } : {}),
    ...(item.availableLocations ? { availableLocations: item.availableLocations } : {}),
  }));
  const setLimit = maxSetsForSession(context.sessionLengthMinutes);
  return [
    'Sos Coach Atlas. Respondé SOLO JSON válido con esta forma:',
    '{"name":"string","description":"string","reason":"string","kind":"gym|home","restSeconds":number,"exercises":[{"exerciseId":number,"sortOrder":number,"targetSets":number,"targetReps":number}]}',
    `Devolvé exactamente ${exerciseCountForSession(context.sessionLengthMinutes, candidatePool.length)} ejercicios distintos.`,
    `Cada targetSets debe estar entre 1 y 8; targetReps entre 1 y 30; suma de series <= ${setLimit}; suma de repeticiones (series × repeticiones) <= ${context.sessionLengthMinutes * 12}.`,
    'Usá SOLO exerciseId del catálogo elegible recibido y respetá sus focos y restricciones. No inventes ejercicios, ids ni metadatos.',
    'La razón debe ser una sola frase breve para el usuario; no reveles razonamiento interno ni cadena de pensamiento.',
    `Contexto: ${JSON.stringify({
      goal: context.goal,
      focusAreas: context.focusAreas,
      location: context.location,
      availableEquipment: context.availableEquipment,
      level: context.level,
      sessionLengthMinutes: context.sessionLengthMinutes,
    })}`,
    `Catálogo elegible: ${JSON.stringify(candidates)}`,
    ...(repairReason ? [
      `La respuesta anterior fue rechazada: ${repairReason}. Corregila siguiendo exactamente el contrato, sin ampliar el catálogo elegible.`,
    ] : []),
  ].join('\n');
}

async function requestGeminiRoutineDraft(
  context: RoutineDraftContext,
  candidatePool: RoutineDraftContext['catalog'],
  deps: RoutineDraftDependencies,
  repairReason?: string,
): Promise<GeminiRequestResult> {
  const key = readGeminiApiKey(deps.env);
  if (!key) return { status: 'unavailable' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? GEMINI_TIMEOUT_MS);
  try {
    const response = await (deps.fetchImpl ?? fetch)(`${GEMINI_GENERATE_URL}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(context, candidatePool, repairReason) }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    });
    if (!response.ok) return { status: 'unavailable' };

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { status: 'invalid', reason: 'el formato JSON no era válido' };
    }
    if (!isRecord(body) || !Array.isArray(body.candidates)) {
      return { status: 'invalid', reason: 'faltaba una respuesta estructurada' };
    }
    const first = body.candidates[0];
    if (!isRecord(first) || !isRecord(first.content) || !Array.isArray(first.content.parts)) {
      return { status: 'invalid', reason: 'faltaba el contenido del borrador' };
    }
    const part = first.content.parts[0];
    if (!isRecord(part) || typeof part.text !== 'string') {
      return { status: 'invalid', reason: 'faltaba el JSON del borrador' };
    }
    const parsed = parseGeminiObject(part.text);
    return isRecord(parsed)
      ? { status: 'response', value: parsed }
      : { status: 'invalid', reason: 'el JSON del borrador no era válido' };
  } catch {
    return { status: 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toLegacyRoutineDraft(draft: RoutineDraft): RoutineDraft {
  return {
    ...draft,
    exercises: draft.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      muscleGroup: exercise.muscleGroup,
      sortOrder: exercise.sortOrder,
      targetSets: exercise.targetSets,
      targetReps: exercise.targetReps,
    })),
  };
}

/**
 * Builds one reusable session draft from the authenticated, ownership-visible catalog.
 *
 * @param context Goal, explicit focus, location, known equipment, level, duration and visible catalog.
 * @param deps Optional Gemini dependencies for deterministic tests.
 * @returns A domain-validated Gemini draft or deterministic fallback with catalog details.
 * @throws {AppError} When the context is invalid or no catalog exercise satisfies hard constraints.
 * @example
 * await buildRoutineDraft({ goal: 'fuerza', focusAreas: ['piernas'], location: 'home', level: 'beginner', sessionLengthMinutes: 45, catalog });
 */
export async function buildRoutineDraft(
  context: RoutineDraftContext,
  deps: RoutineDraftDependencies = {},
): Promise<RoutineDraft> {
  const normalizedContext = normalizeRoutineDraftContext(context);
  const candidatePool = getEligibleRoutineExercises(normalizedContext);
  const fallback = buildRoutineFallback(normalizedContext, candidatePool);
  const first = await requestGeminiRoutineDraft(normalizedContext, candidatePool, deps);

  if (first.status === 'unavailable') return fallback;
  if (first.status === 'response') {
    const validated = validateGeminiRoutineDraft(first.value, normalizedContext, candidatePool, fallback);
    if (validated) return validated;
  }

  const repairReason = first.status === 'invalid'
    ? first.reason
    : 'los ejercicios, el foco, la cantidad o el volumen no cumplieron los límites';
  const repaired = await requestGeminiRoutineDraft(normalizedContext, candidatePool, deps, repairReason);
  if (repaired.status === 'response') {
    const validated = validateGeminiRoutineDraft(repaired.value, normalizedContext, candidatePool, fallback);
    if (validated) return validated;
  }
  return fallback;
}

/**
 * @deprecated Compatibility only: map each legacy weekly day to 20 minutes, capped at 90.
 */
export function legacySessionLengthMinutes(daysPerWeek: number | undefined): number {
  if (daysPerWeek === undefined || !Number.isInteger(daysPerWeek) || daysPerWeek < 1 || daysPerWeek > 7) {
    throw new AppError('VALIDATION', 'La frecuencia semanal heredada es inválida');
  }
  return Math.min(90, daysPerWeek * 20);
}

/**
 * @deprecated Use buildRoutineDraft with an explicit sessionLengthMinutes context.
 */
export async function generateRoutineDraft(
  brief: RoutineDraftBrief,
  catalog: RoutineDraftContext['catalog'],
  deps: RoutineDraftDependencies = {},
): Promise<RoutineDraft> {
  const draft = await buildRoutineDraft({
    goal: brief.goal,
    focusAreas: brief.focusAreas ?? [],
    location: brief.location,
    availableEquipment: brief.availableEquipment,
    level: brief.level,
    sessionLengthMinutes: brief.sessionLengthMinutes ?? legacySessionLengthMinutes(brief.daysPerWeek),
    catalog,
  }, deps);
  return toLegacyRoutineDraft(draft);
}
