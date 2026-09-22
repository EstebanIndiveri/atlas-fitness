import { generateRoutineDraft } from '@/lib/ai/routine-draft';
import type { RoutineDraftExercise, RoutineDraftLevel, RoutineDraftLocation } from '@/lib/ai/routine-draft';
import type { ExerciseCatalogItem } from '@/types/exercise';

export type WeeklyPlanDayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface WeeklyPlanDraftDay {
  dayOfWeek: WeeklyPlanDayOfWeek;
  title: string;
  focus: string;
  exercises: RoutineDraftExercise[];
}

export interface WeeklyPlanDraft {
  name: string;
  goal: string;
  days: WeeklyPlanDraftDay[];
}

export interface WeeklyPlanDraftInput {
  goal: string;
  daysPerWeek: number;
  experience: RoutineDraftLevel;
  availableEquipment: readonly string[];
  sessionLengthMinutes: number;
  focusAreas: readonly string[];
  catalog: readonly ExerciseCatalogItem[];
}

const FALLBACK_GOAL = 'mejorar condición general';
const MAX_GOAL_LENGTH = 60;
const DAY_PATTERNS: Record<number, readonly string[]> = {
  1: ['Full body técnico'],
  2: ['Tren superior', 'Tren inferior'],
  3: ['Empuje', 'Tirón', 'Piernas'],
  4: ['Torso fuerza', 'Piernas fuerza', 'Empuje accesorio', 'Tirón y core'],
  5: ['Empuje', 'Tirón', 'Piernas', 'Torso volumen', 'Core y movilidad'],
  6: ['Empuje', 'Tirón', 'Piernas', 'Hombros y core', 'Cadena posterior', 'Full body liviano'],
};
const WEEKDAY_PATTERNS: Record<number, readonly WeeklyPlanDayOfWeek[]> = {
  1: [1],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
};

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

/**
 * Builds a deterministic, typed weekly plan draft by composing one Atlas routine draft per day.
 *
 * @param input User goal, training frequency, experience, equipment, focus areas, and catalog.
 * @returns A weekly proposal with scheduled days and exercises from the authenticated catalog.
 * @throws {Error} When the catalog is empty.
 * @example
 * await generateWeeklyPlanDraft({ goal: 'fuerza', daysPerWeek: 3, experience: 'intermediate', availableEquipment: ['gym'], sessionLengthMinutes: 55, focusAreas: ['piernas'], catalog });
 */
export async function generateWeeklyPlanDraft(input: WeeklyPlanDraftInput): Promise<WeeklyPlanDraft> {
  if (input.catalog.length === 0) {
    throw new Error('No hay ejercicios disponibles para armar un plan semanal.');
  }

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
      return {
        dayOfWeek: weekdays[index] ?? 1,
        title: `Día ${index + 1}`,
        focus,
        exercises: routine.exercises,
      };
    }),
  );

  return {
    name: `Coach Atlas · ${shortGoal(goal)}`,
    goal,
    days: draftDays,
  };
}
