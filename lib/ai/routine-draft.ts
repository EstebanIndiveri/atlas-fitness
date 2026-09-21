import { GEMINI_GENERATE_URL, GEMINI_TIMEOUT_MS, readGeminiApiKey } from '@/lib/ai/gemini';
import type { ExerciseCatalogItem } from '@/types/exercise';
import type { RoutineKind } from '@/types/routine';
export type RoutineDraftSource = 'gemini' | 'fallback';
export type RoutineDraftLocation = RoutineKind;
export type RoutineDraftLevel = 'beginner' | 'intermediate' | 'advanced';
export interface RoutineDraftBrief {
  goal: string; daysPerWeek: number; location: RoutineDraftLocation; level: RoutineDraftLevel;
}
export interface RoutineDraftExercise {
  exerciseId: number; exerciseName: string; muscleGroup: string; sortOrder: number; targetSets: number; targetReps: number;
}
export interface RoutineDraft {
  source: RoutineDraftSource; name: string; description: string; reason: string;
  kind: RoutineKind; restSeconds: number; exercises: RoutineDraftExercise[];
}
type GeminiFetch = typeof fetch;
type RawGeminiExercise = { exerciseId?: unknown; sortOrder?: unknown; targetSets?: unknown; targetReps?: unknown };
type RawGeminiDraft = {
  name?: unknown; description?: unknown; kind?: unknown; reason?: unknown; restSeconds?: unknown; exercises?: unknown;
};
const LEVEL_TARGETS: Record<RoutineDraftLevel, { sets: number; reps: number; rest: number }> = {
  beginner: { sets: 2, reps: 12, rest: 75 },
  intermediate: { sets: 3, reps: 10, rest: 120 },
  advanced: { sets: 4, reps: 8, rest: 150 },
};
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function parseJsonObject(raw: string): unknown {
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
function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}
function shortGoal(goal: string): string {
  const trimmed = goal.trim().replace(/\s+/g, ' ');
  return trimmed.length > 36 ? `${trimmed.slice(0, 33).trim()}…` : trimmed;
}
function selectCatalogExercises(
  catalog: readonly ExerciseCatalogItem[],
  count: number,
): ExerciseCatalogItem[] {
  const selected: ExerciseCatalogItem[] = [];
  const usedIds = new Set<number>();
  const usedGroups = new Set<string>();
  for (const item of catalog) {
    const group = item.muscleGroup.trim().toLowerCase();
    if (!usedGroups.has(group)) {
      selected.push(item);
      usedIds.add(item.id);
      usedGroups.add(group);
    }
    if (selected.length >= count) return selected;
  }
  for (const item of catalog) {
    if (!usedIds.has(item.id)) selected.push(item);
    if (selected.length >= count) return selected;
  }
  return selected;
}
function withCatalogDetails(
  item: ExerciseCatalogItem,
  sortOrder: number,
  targets: { sets: number; reps: number },
): RoutineDraftExercise {
  return {
    exerciseId: item.id,
    exerciseName: item.name,
    muscleGroup: item.muscleGroup,
    sortOrder,
    targetSets: targets.sets,
    targetReps: targets.reps,
  };
}
function levelLabel(level: RoutineDraftLevel): string {
  if (level === 'beginner') return 'inicial';
  return level === 'advanced' ? 'avanzado' : 'intermedio';
}
function locationLabel(location: RoutineDraftLocation): string {
  return location === 'home' ? 'casa' : 'gimnasio';
}
function buildFallbackReason(brief: RoutineDraftBrief, selected: readonly ExerciseCatalogItem[]): string {
  const groups = new Set(selected.map((item) => item.muscleGroup.trim().toLowerCase()));
  const movementText = groups.size === selected.length
    ? `${selected.length} movimientos de grupos musculares distintos`
    : `${selected.length} movimientos reales del catálogo`;
  return `Atlas eligió ${movementText} para ${brief.goal.trim()}, con volumen ${levelLabel(brief.level)} y ejecución viable en ${locationLabel(brief.location)}.`;
}
function cleanReason(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed ? trimmed.slice(0, 320) : fallback;
}
function buildFallbackDraft(
  brief: RoutineDraftBrief,
  catalog: readonly ExerciseCatalogItem[],
): RoutineDraft {
  const targets = LEVEL_TARGETS[brief.level];
  const targetCount = Math.min(catalog.length, Math.max(2, Math.min(6, brief.daysPerWeek * 2)));
  const selected = selectCatalogExercises(catalog, targetCount);
  return {
    source: 'fallback',
    name: `Coach Atlas · ${shortGoal(brief.goal)}`,
    description: `Borrador ${brief.location === 'home' ? 'para casa' : 'de gimnasio'} de ${brief.daysPerWeek} día${brief.daysPerWeek === 1 ? '' : 's'} por semana, armado con ejercicios reales del catálogo.`,
    reason: buildFallbackReason(brief, selected),
    kind: brief.location,
    restSeconds: targets.rest,
    exercises: selected.map((item, index) => withCatalogDetails(item, index, targets)),
  };
}
function normalizeGeminiDraft(
  rawDraft: RawGeminiDraft,
  brief: RoutineDraftBrief,
  catalog: readonly ExerciseCatalogItem[],
): RoutineDraft | null {
  const byId = new Map(catalog.map((item) => [item.id, item]));
  const targets = LEVEL_TARGETS[brief.level];
  const rawExercises = Array.isArray(rawDraft.exercises) ? rawDraft.exercises : [];
  const usedIds = new Set<number>();
  const exercises: RoutineDraftExercise[] = [];
  for (const rawExercise of rawExercises) {
    if (!isRecord(rawExercise)) continue;
    const exercise = rawExercise as RawGeminiExercise;
    const exerciseId = exercise.exerciseId;
    if (typeof exerciseId !== 'number' || !Number.isInteger(exerciseId) || usedIds.has(exerciseId)) {
      continue;
    }
    const catalogItem = byId.get(exerciseId);
    if (!catalogItem) continue;
    usedIds.add(exerciseId);
    exercises.push({
      ...withCatalogDetails(catalogItem, exercises.length, targets),
      targetSets: clampInteger(exercise.targetSets, 1, 8, targets.sets),
      targetReps: clampInteger(exercise.targetReps, 1, 30, targets.reps),
    });
  }
  const fallback = buildFallbackDraft(brief, catalog);
  for (const fallbackExercise of fallback.exercises) {
    if (!usedIds.has(fallbackExercise.exerciseId)) {
      exercises.push({ ...fallbackExercise, sortOrder: exercises.length });
      usedIds.add(fallbackExercise.exerciseId);
    }
  }
  if (exercises.length === 0) return null;
  return {
    source: 'gemini',
    name: typeof rawDraft.name === 'string' && rawDraft.name.trim() ? rawDraft.name.trim() : fallback.name,
    description:
      typeof rawDraft.description === 'string' && rawDraft.description.trim()
        ? rawDraft.description.trim()
        : fallback.description,
    reason: cleanReason(rawDraft.reason, fallback.reason),
    kind: brief.location,
    restSeconds: clampInteger(rawDraft.restSeconds, 0, 3600, fallback.restSeconds),
    exercises,
  };
}
function buildPrompt(brief: RoutineDraftBrief, catalog: readonly ExerciseCatalogItem[]): string {
  const catalogPayload = catalog.map((item) => ({
    id: item.id,
    name: item.name,
    muscleGroup: item.muscleGroup,
  }));
  return [
    'Sos Coach Atlas. Respondé SOLO JSON válido con esta forma:',
    '{"name":"string","description":"string","reason":"string","kind":"gym|home","restSeconds":number,"exercises":[{"exerciseId":number,"sortOrder":number,"targetSets":number,"targetReps":number}]}',
    'Elegí exerciseId SOLO del catálogo recibido. No inventes ids ni ejercicios.',
    `Brief: ${JSON.stringify(brief)}`,
    `Catálogo: ${JSON.stringify(catalogPayload)}`,
  ].join('\n');
}
async function fetchGeminiRoutineDraft(
  brief: RoutineDraftBrief,
  catalog: readonly ExerciseCatalogItem[],
  deps: { fetchImpl?: GeminiFetch; env?: Record<string, string | undefined>; timeoutMs?: number },
): Promise<RawGeminiDraft | null> {
  const key = readGeminiApiKey(deps.env);
  if (!key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? GEMINI_TIMEOUT_MS);
  try {
    const response = await (deps.fetchImpl ?? fetch)(`${GEMINI_GENERATE_URL}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(brief, catalog) }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!isRecord(body) || !Array.isArray(body.candidates)) return null;
    const first = body.candidates[0];
    if (!isRecord(first) || !isRecord(first.content) || !Array.isArray(first.content.parts)) return null;
    const part = first.content.parts[0];
    if (!isRecord(part) || typeof part.text !== 'string') return null;
    const parsed = parseJsonObject(part.text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
/**
 * Generates a typed routine draft from Gemini or a deterministic catalog-based fallback.
 *
 * @param brief User goal, days per week, location, and training level.
 * @param catalog Authenticated exercise catalog; every returned exercise references these ids only.
 * @param deps Optional fetch/env dependencies for deterministic tests.
 * @returns A valid routine draft ready to submit to the existing routine creation API.
 * @throws {Error} When the authenticated catalog is empty.
 * @example
 * await generateRoutineDraft({ goal: 'fuerza', daysPerWeek: 3, location: 'gym', level: 'intermediate' }, catalog);
 */
export async function generateRoutineDraft(
  brief: RoutineDraftBrief,
  catalog: readonly ExerciseCatalogItem[],
  deps: { fetchImpl?: GeminiFetch; env?: Record<string, string | undefined>; timeoutMs?: number } = {},
): Promise<RoutineDraft> {
  if (catalog.length === 0) {
    throw new Error('No hay ejercicios disponibles para armar una rutina.');
  }
  const geminiDraft = await fetchGeminiRoutineDraft(brief, catalog, deps);
  if (geminiDraft) {
    const normalized = normalizeGeminiDraft(geminiDraft, brief, catalog);
    if (normalized) return normalized;
  }
  return buildFallbackDraft(brief, catalog);
}
