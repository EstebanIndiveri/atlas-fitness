import {
  adaptDeterministically,
  coachAiAdaptationResultSchema,
  coachGeminiOutputSchema,
  ESTIMATED_MINUTES_PER_SET,
  type CoachGeminiOutput,
} from '@/lib/ai/coach/adaptation';
import { GEMINI_GENERATE_URL, GEMINI_TIMEOUT_MS, readGeminiApiKey } from '@/lib/ai/gemini';
import type { CoachAdaptationContext, CoachAdaptationResult, CoachExerciseDelta, CoachRoutineExerciseSummary, CoachRoutineSummary } from '@/types/coach';

type GenerateContent = (prompt: string) => Promise<string | null>;

export interface CoachGeminiAdaptationDeps {
  generateContent?: GenerateContent;
  fetchImpl?: typeof fetch;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
}

/**
 * Generates an explainable Coach Atlas adaptation with Gemini structured output.
 * Any unavailable, malformed, or invariant-breaking AI response falls back to
 * the deterministic engine so callers always receive a usable recommendation.
 *
 * @param context Routine, energy, mood, and optional user note used as source data.
 * @param deps Optional injectable model/fetch dependencies for deterministic tests.
 * @returns AI-tagged adaptation when validated, otherwise deterministic fallback.
 * @example
 * await generateCoachAdaptation({ routine: { exercises: [] }, energy: 'high', mood: 4 })
 */
export async function generateCoachAdaptation(
  context: CoachAdaptationContext,
  deps: CoachGeminiAdaptationDeps = {},
): Promise<CoachAdaptationResult> {
  try {
    const generateContent = deps.generateContent ?? ((prompt) => fetchCoachAdaptation(prompt, deps));
    const raw = await generateContent(buildPrompt(context));
    if (!raw) return adaptDeterministically(context);
    const output = parseOutput(raw);
    if (!output) return adaptDeterministically(context);
    const result = buildResult(context, output);
    return result ?? adaptDeterministically(context);
  } catch {
    return adaptDeterministically(context);
  }
}

function buildPrompt(context: CoachAdaptationContext): string {
  return [
    'Sos Coach Atlas. Respondé SOLO JSON válido, sin markdown, con esta forma exacta:',
    '{"reason":"string es-AR","suggestedChanges":[{"kind":"keep_exercise|remove_exercise|reduce_sets|reduce_reps|reorder_exercise","queueItemId":"exerciseId como string","reason":"string es-AR","targetSets":2,"targetReps":10,"sortOrder":1}]}',
    'No inventes ejercicios, ids, métricas, biometría ni números fuera del input.',
    'queueItemId debe ser uno de los exerciseId enviados como string.',
    'Mantené movimientos compuestos/principales; no los remuevas ni reduzcas.',
    'La recomendación debe ser explicable y el usuario conserva control: proponé cambios, no los apliques en silencio.',
    `Contexto: ${JSON.stringify({
      energy: context.energy,
      mood: context.mood,
      freeText: context.freeText ?? null,
      exercises: context.routine.exercises.map((exercise, index) => ({
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        sets: exercise.sets,
        category: exercise.category ?? null,
        isCompound: exercise.isCompound ?? index < 2,
        muscleGroup: exercise.muscleGroup ?? null,
        sortOrder: exercise.sortOrder ?? index,
      })),
    })}`,
  ].join('\n');
}

async function fetchCoachAdaptation(prompt: string, deps: Omit<CoachGeminiAdaptationDeps, 'generateContent'>): Promise<string | null> {
  const key = readGeminiApiKey(deps.env);
  if (!key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? GEMINI_TIMEOUT_MS);
  try {
    const response = await (deps.fetchImpl ?? fetch)(
      `${GEMINI_GENERATE_URL}?key=${encodeURIComponent(key)}`,
      {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
      }),
      },
    );
    if (!response.ok) return null;
    return extractGeminiText(await response.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extractGeminiText(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const candidates = (body as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const first = candidates[0] as { content?: { parts?: { text?: unknown }[] } };
  const text = first.content?.parts?.[0]?.text;
  return typeof text === 'string' ? text : null;
}

function parseOutput(raw: string): CoachGeminiOutput | null {
  const parsed = extractJsonObject(raw);
  const result = coachGeminiOutputSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

function buildResult(context: CoachAdaptationContext, output: CoachGeminiOutput): CoachAdaptationResult | null {
  const exercises = context.routine.exercises;
  const exercisesById = new Map(exercises.map((exercise) => [String(exercise.exerciseId), exercise]));
  const deltas = context.routine.exercises.map((exercise) => createDelta(exercise));

  for (const change of output.suggestedChanges) {
    const exercise = exercisesById.get(change.queueItemId);
    if (!exercise || changesMainMovement(exercises, exercise, change)) return null;
    const delta = deltas.find((item) => item.exerciseId === exercise.exerciseId);
    if (!delta) return null;
    if (change.kind === 'remove_exercise') {
      delta.action = 'removed';
      delta.toSets = 0;
    }
    if (change.kind === 'reduce_sets') {
      if (change.targetSets >= delta.fromSets) return null;
      delta.action = 'reduced';
      delta.toSets = change.targetSets;
    }
    if (change.kind === 'reduce_reps' || change.kind === 'reorder_exercise') return null;
  }

  const original = summarize(exercises);
  const adapted = summarizeDeltas(deltas);
  const parsed = coachAiAdaptationResultSchema.safeParse({ original, adapted, exerciseDeltas: deltas, reason: output.reason, source: 'ai' });
  return parsed.success ? parsed.data : null;
}

function changesMainMovement(
  exercises: readonly CoachRoutineExerciseSummary[],
  exercise: CoachRoutineExerciseSummary,
  change: CoachGeminiOutput['suggestedChanges'][number],
): boolean {
  const index = exercises.findIndex((item) => item.exerciseId === exercise.exerciseId);
  const reduces = change.kind === 'remove_exercise' || change.kind === 'reduce_sets' || change.kind === 'reduce_reps';
  return reduces && isMainMovement(exercise, index);
}

function isMainMovement(exercise: CoachRoutineExerciseSummary, index: number): boolean {
  if (exercise.isCompound === true || exercise.category === 'compound') return true;
  if (exercise.isCompound === false || exercise.category === 'accessory') return false;
  return index >= 0 && index < 2;
}

function createDelta(exercise: CoachRoutineExerciseSummary): CoachExerciseDelta {
  const sets = Math.max(0, Math.floor(exercise.sets));
  return { exerciseId: exercise.exerciseId, name: exercise.name, action: 'kept', fromSets: sets, toSets: sets };
}

function summarize(exercises: readonly CoachRoutineExerciseSummary[]): CoachRoutineSummary {
  const setCount = exercises.reduce((total, exercise) => total + Math.max(0, Math.floor(exercise.sets)), 0);
  return { exerciseCount: exercises.length, setCount, estMinutes: setCount * ESTIMATED_MINUTES_PER_SET };
}

function summarizeDeltas(deltas: readonly CoachExerciseDelta[]): CoachRoutineSummary {
  const setCount = deltas.reduce((total, delta) => total + delta.toSets, 0);
  return { exerciseCount: deltas.filter((delta) => delta.toSets > 0).length, setCount, estMinutes: setCount * ESTIMATED_MINUTES_PER_SET };
}
