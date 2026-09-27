import type {
  RoutineDraft,
  RoutineDraftCatalogItem,
  RoutineDraftContext,
  RoutineDraftExercise,
} from './routine-draft-types';
import {
  buildRoutineFallback,
  exerciseCountForSession,
  maxSetsForSession,
  normalizeIntent,
} from './routine-draft-selection';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, fallback: string, maxLength: number, minLength = 1): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.replace(/[\p{Cc}\p{Cf}]+/gu, ' ').trim().replace(/\s+/g, ' ');
  return cleaned.length < minLength ? fallback : cleaned.slice(0, maxLength);
}

function boundedInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) return fallback;
  return value;
}

function toCatalogExercise(
  item: RoutineDraftCatalogItem,
  sortOrder: number,
  targetSets: number,
  targetReps: number,
): RoutineDraftExercise {
  return {
    exerciseId: item.id,
    exerciseName: item.name,
    muscleGroup: item.muscleGroup,
    instructions: item.instructions,
    imageUrl: item.imageUrl,
    videoUrl: item.videoUrl,
    ...(item.equipment ? { equipment: [...item.equipment] } : {}),
    sortOrder,
    targetSets,
    targetReps,
  };
}

export function parseGeminiObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function validateGeminiRoutineDraft(
  rawDraft: unknown,
  context: RoutineDraftContext,
  catalog: readonly RoutineDraftCatalogItem[],
  fallback: RoutineDraft = buildRoutineFallback(context, catalog),
): RoutineDraft | null {
  if (!isRecord(rawDraft)) return null;
  const draft = rawDraft;
  const expectedCount = exerciseCountForSession(context.sessionLengthMinutes, catalog.length);
  if (!Array.isArray(draft.exercises) || draft.exercises.length !== expectedCount) return null;

  const byId = new Map(catalog.map((item) => [item.id, item]));
  const usedIds = new Set<number>();
  const exercises: RoutineDraftExercise[] = [];
  let totalSets = 0;
  let totalReps = 0;
  for (const rawExercise of draft.exercises) {
    if (!isRecord(rawExercise)) return null;
    const id = rawExercise.exerciseId;
    const item = typeof id === 'number' && Number.isInteger(id) ? byId.get(id) : undefined;
    if (!item || usedIds.has(item.id)) return null;
    if (normalizeIntent(item.muscleGroup).length === 0) return null;

    const sets = boundedInteger(rawExercise.targetSets, 1, 8, 0);
    const reps = boundedInteger(rawExercise.targetReps, 1, 30, 0);
    if (sets === 0 || reps === 0) return null;
    usedIds.add(item.id);
    totalSets += sets;
    totalReps += sets * reps;
    exercises.push(toCatalogExercise(item, exercises.length, sets, reps));
  }

  if (totalSets > maxSetsForSession(context.sessionLengthMinutes)
    || totalReps > context.sessionLengthMinutes * 12) return null;

  return {
    source: 'gemini',
    name: cleanText(draft.name, fallback.name, 80, 2),
    description: cleanText(draft.description, fallback.description, 320, 2),
    reason: cleanText(draft.reason, fallback.reason, 320),
    kind: context.location,
    restSeconds: boundedInteger(draft.restSeconds, 0, 3600, fallback.restSeconds),
    exercises,
  };
}
