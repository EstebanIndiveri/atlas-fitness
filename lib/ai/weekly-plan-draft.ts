import { GEMINI_GENERATE_URL, GEMINI_TIMEOUT_MS, readGeminiApiKey } from '@/lib/ai/gemini';
import { generateRoutineDraft } from '@/lib/ai/routine-draft';
import type { RoutineDraftExercise, RoutineDraftLevel, RoutineDraftLocation } from '@/lib/ai/routine-draft';
import type { ExerciseCatalogItem } from '@/types/exercise';

import { buildWeeklyPlanPrompt } from './weekly-plan-prompt';

export type WeeklyPlanDayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type WeeklyPlanDraftSource = 'gemini' | 'fallback';

export interface WeeklyPlanDraftDay { dayOfWeek: WeeklyPlanDayOfWeek; title: string; focus: string; exercises: RoutineDraftExercise[]; }

export interface WeeklyPlanDraft { source: WeeklyPlanDraftSource; name: string; goal: string; days: WeeklyPlanDraftDay[]; }

export interface WeeklyPlanDraftInput {
  goal: string; daysPerWeek: number; experience: RoutineDraftLevel; availableEquipment: readonly string[];
  sessionLengthMinutes: number; focusAreas: readonly string[]; catalog: readonly ExerciseCatalogItem[];
}

type GeminiFetch = typeof fetch;
type WeeklyPlanDraftDeps = { fetchImpl?: GeminiFetch; env?: Record<string, string | undefined>; timeoutMs?: number };
type RawGeminiExercise = { exerciseId?: unknown; targetSets?: unknown; targetReps?: unknown };
type RawGeminiDay = { dayOfWeek?: unknown; title?: unknown; focus?: unknown; exercises?: unknown };
type RawGeminiDraft = { name?: unknown; goal?: unknown; days?: unknown };

const FALLBACK_GOAL = 'mejorar condición general';
const MAX_GOAL_LENGTH = 60;
const LEVEL_TARGETS: Record<RoutineDraftLevel, { sets: number; reps: number }> = {
  beginner: { sets: 2, reps: 12 }, intermediate: { sets: 3, reps: 10 }, advanced: { sets: 4, reps: 8 },
};
const DAY_PATTERNS: Record<number, readonly string[]> = {
  1: ['Full body técnico'],
  2: ['Tren superior', 'Tren inferior'],
  3: ['Empuje', 'Tirón', 'Piernas'],
  4: ['Torso fuerza', 'Piernas fuerza', 'Empuje accesorio', 'Tirón y core'],
  5: ['Empuje', 'Tirón', 'Piernas', 'Torso volumen', 'Core y movilidad'],
  6: ['Empuje', 'Tirón', 'Piernas', 'Hombros y core', 'Cadena posterior', 'Full body liviano'],
};
const WEEKDAY_PATTERNS: Record<number, readonly WeeklyPlanDayOfWeek[]> = {
  1: [1], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6],
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

function parseDayOfWeek(value: unknown): WeeklyPlanDayOfWeek | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 6) return null;
  return value as WeeklyPlanDayOfWeek;
}

function cleanText(value: unknown, fallback: string, maxLength: number, minLength = 1): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.replace(/[\p{Cc}\p{Cf}]+/gu, ' ').trim().replace(/\s+/g, ' ');
  if (trimmed.length < minLength) return fallback;
  return trimmed.slice(0, maxLength).trim();
}

function clampDays(daysPerWeek: number): number {
  if (!Number.isFinite(daysPerWeek)) return 3;
  return Math.min(6, Math.max(1, Math.trunc(daysPerWeek)));
}

function normalizeGoal(goal: string): string {
  const cleaned = goal.trim().replace(/\s+/g, ' ');
  const honestGoal = cleaned.length > 0 ? cleaned : FALLBACK_GOAL;
  return honestGoal.slice(0, MAX_GOAL_LENGTH).trim();
}

function shortGoal(goal: string): string {
  return goal.length > 36 ? `${goal.slice(0, 33).trim()}…` : goal;
}

function inferLocation(availableEquipment: readonly string[]): RoutineDraftLocation {
  const joined = availableEquipment.join(' ').toLowerCase();
  return /(gym|gimnasio|máquina|maquina|barra|mancuerna|rack|polea)/u.test(joined) ? 'gym' : 'home';
}

function focusCatalog(catalog: readonly ExerciseCatalogItem[], focus: string): ExerciseCatalogItem[] {
  const normalized = focus.toLowerCase();
  const preferred = catalog.filter((item) => {
    const group = item.muscleGroup.toLowerCase();
    return normalized.includes(group) || group.includes(normalized) || normalized.includes(item.name.toLowerCase());
  });
  const preferredIds = new Set(preferred.map((item) => item.id));
  return [...preferred, ...catalog.filter((item) => !preferredIds.has(item.id))];
}

function buildFocuses(days: number, focusAreas: readonly string[]): string[] {
  const base = DAY_PATTERNS[days] ?? DAY_PATTERNS[3];
  const custom = focusAreas.map((area) => area.trim()).filter((area) => area.length > 0);
  return base.map((focus, index) => {
    const area = custom[index % Math.max(1, custom.length)];
    return area && !focus.toLowerCase().includes(area.toLowerCase()) ? `${focus} · ${area}` : focus;
  });
}

async function buildFallbackDraft(input: WeeklyPlanDraftInput): Promise<WeeklyPlanDraft> {
  const days = clampDays(input.daysPerWeek);
  const goal = normalizeGoal(input.goal);
  const focuses = buildFocuses(days, input.focusAreas);
  const weekdays = WEEKDAY_PATTERNS[days] ?? WEEKDAY_PATTERNS[3];
  const location = inferLocation(input.availableEquipment);

  const draftDays = await Promise.all(
    focuses.map(async (focus, index): Promise<WeeklyPlanDraftDay> => {
      const routine = await generateRoutineDraft(
        {
          goal: `${goal}. Foco del día: ${focus}. Duración disponible: ${input.sessionLengthMinutes} minutos.`,
          daysPerWeek: 1,
          location,
          level: input.experience,
        },
        focusCatalog(input.catalog, focus),
        { env: { GEMINI_API_KEY: undefined } },
      );
      return { dayOfWeek: weekdays[index] ?? 1, title: `Día ${index + 1}`, focus, exercises: routine.exercises };
    }),
  );

  return { source: 'fallback', name: `Coach Atlas · ${shortGoal(goal)}`, goal, days: draftDays };
}

function normalizeGeminiExercises(
  rawExercises: unknown,
  catalogById: ReadonlyMap<number, ExerciseCatalogItem>,
  targets: { sets: number; reps: number },
): RoutineDraftExercise[] {
  if (!Array.isArray(rawExercises)) return [];
  const usedIds = new Set<number>();
  const exercises: RoutineDraftExercise[] = [];
  for (const rawExercise of rawExercises) {
    if (!isRecord(rawExercise)) continue;
    const exercise = rawExercise as RawGeminiExercise;
    const exerciseId = exercise.exerciseId;
    if (typeof exerciseId !== 'number' || !Number.isInteger(exerciseId) || usedIds.has(exerciseId)) continue;
    const catalogItem = catalogById.get(exerciseId);
    if (!catalogItem) continue;
    usedIds.add(exerciseId);
    exercises.push({
      exerciseId: catalogItem.id, exerciseName: catalogItem.name, muscleGroup: catalogItem.muscleGroup, sortOrder: exercises.length,
      targetSets: clampInteger(exercise.targetSets, 1, 8, targets.sets), targetReps: clampInteger(exercise.targetReps, 1, 30, targets.reps),
    });
  }
  return exercises;
}

function normalizeGeminiDraft(
  rawDraft: RawGeminiDraft,
  fallback: WeeklyPlanDraft,
  input: WeeklyPlanDraftInput,
): WeeklyPlanDraft | null {
  const rawDays = Array.isArray(rawDraft.days) ? rawDraft.days : [];
  if (rawDays.length !== fallback.days.length) return null;
  const catalogById = new Map(input.catalog.map((item) => [item.id, item]));
  const targets = LEVEL_TARGETS[input.experience];
  const days: WeeklyPlanDraftDay[] = [];
  const usedWeekdays = new Set<WeeklyPlanDayOfWeek>();
  for (const [index, rawDay] of rawDays.entries()) {
    if (!isRecord(rawDay)) continue;
    const day = rawDay as RawGeminiDay;
    const fallbackDay = fallback.days[index];
    if (!fallbackDay) continue;
    const dayOfWeek = parseDayOfWeek(day.dayOfWeek);
    if (dayOfWeek === null || usedWeekdays.has(dayOfWeek)) return null;
    const exercises = normalizeGeminiExercises(day.exercises, catalogById, targets);
    if (exercises.length === 0) continue;
    usedWeekdays.add(dayOfWeek);
    days.push({
      dayOfWeek, title: cleanText(day.title, fallbackDay.title, 60, 2),
      focus: cleanText(day.focus, fallbackDay.focus, 80, 2), exercises,
    });
  }
  if (days.length !== fallback.days.length) return null;
  return { source: 'gemini', name: cleanText(rawDraft.name, fallback.name, 80, 2), goal: fallback.goal, days };
}

async function fetchGeminiWeeklyPlanDraft(
  input: WeeklyPlanDraftInput,
  normalizedGoal: string,
  days: number,
  deps: WeeklyPlanDraftDeps,
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
      body: JSON.stringify({ contents: [{ parts: [{ text: buildWeeklyPlanPrompt(input, normalizedGoal, days) }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }),
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
 * @param input User goal, training frequency, experience, equipment, focus areas, and catalog.
 * @param deps Optional fetch/env dependencies for deterministic tests.
 * @returns A weekly proposal from Gemini or the deterministic fallback.
 * @throws {Error} When the catalog is empty.
 * @example
 * await generateWeeklyPlanDraft({ goal: 'fuerza', daysPerWeek: 3, experience: 'intermediate', availableEquipment: ['gym'], sessionLengthMinutes: 55, focusAreas: ['piernas'], catalog });
 */
export async function generateWeeklyPlanDraft(
  input: WeeklyPlanDraftInput,
  deps: WeeklyPlanDraftDeps = {},
): Promise<WeeklyPlanDraft> {
  if (input.catalog.length === 0) {
    throw new Error('No hay ejercicios disponibles para armar un plan semanal.');
  }

  const fallback = await buildFallbackDraft(input);
  const geminiDraft = await fetchGeminiWeeklyPlanDraft(input, fallback.goal, fallback.days.length, deps);
  return geminiDraft ? (normalizeGeminiDraft(geminiDraft, fallback, input) ?? fallback) : fallback;
}
