import { AppError } from '@/types/errors';

import { buildRoutineDraft } from './routine-draft';
import { inferWeeklyLocation } from './weekly-plan-focus';
import { buildDeterministicWeeklyStrategy, resolveWeeklyStrategy } from './weekly-plan-strategy';
import { validateWeeklyProposal } from './weekly-plan-week-validation';
import type {
  RoutineDraft,
  RoutineDraftContext,
  RoutineDraftDependencies,
  RoutineDraftLevel,
  RoutineDraftLocation,
} from './routine-draft-types';
import type {
  WeeklyPlanComposedDay,
  WeeklyPlanComposerDay,
  WeeklyPlanComposerDependencies,
  WeeklyPlanComposerDraft,
  WeeklyPlanComposerInput,
  WeeklyPlanRoutineEngine,
  WeeklyPlanStrategy,
  WeeklyPlanStrategyDay,
  WeeklyPlanValidationProposal,
  WeeklyPlanValidationResult,
} from './weekly-plan-week-types';

const MIN_GOAL_LENGTH = 2;
const MAX_GOAL_LENGTH = 160;
const MIN_SESSION_LENGTH_MINUTES = 15;
const MAX_SESSION_LENGTH_MINUTES = 180;
const MIN_DAYS_PER_WEEK = 1;
const MAX_DAYS_PER_WEEK = 6;
const MAX_FOCUS_AREAS = 6;
const MAX_EQUIPMENT_ENTRIES = 12;
const MAX_LABEL_LENGTH = 40;
const EMPTY_CATALOG_MESSAGE = 'No hay ejercicios en el catálogo visible para armar la semana.';
const LEVELS: readonly RoutineDraftLevel[] = ['beginner', 'intermediate', 'advanced'];

type WeeklyPlanComposedWeek = WeeklyPlanValidationProposal;

function isTextEntry(entry: unknown, maxLength: number): boolean {
  return typeof entry === 'string' && entry.trim().length > 0 && entry.trim().length <= maxLength;
}

function isTextList(value: unknown, maxEntries: number): boolean {
  return (
    Array.isArray(value) &&
    value.length <= maxEntries &&
    value.every((entry: unknown) => isTextEntry(entry, MAX_LABEL_LENGTH))
  );
}

/**
 * Rejects a weekly brief the composer cannot honour before any engine or Gemini work starts.
 *
 * @param input Weekly brief received from the guided plan coach.
 * @throws {AppError} When a field is out of range or the visible catalog has no exercises.
 * @example
 * assertComposerBrief({ ...brief, daysPerWeek: 0 }); // throws VALIDATION
 */
function assertComposerBrief(input: WeeklyPlanComposerInput): void {
  const goal = input.goal.trim();
  if (goal.length < MIN_GOAL_LENGTH || goal.length > MAX_GOAL_LENGTH) {
    throw new AppError(
      'VALIDATION',
      `El objetivo debe tener entre ${MIN_GOAL_LENGTH} y ${MAX_GOAL_LENGTH} caracteres.`,
    );
  }
  if (
    !Number.isInteger(input.daysPerWeek) ||
    input.daysPerWeek < MIN_DAYS_PER_WEEK ||
    input.daysPerWeek > MAX_DAYS_PER_WEEK
  ) {
    throw new AppError(
      'VALIDATION',
      `La cantidad de días de entrenamiento debe estar entre ${MIN_DAYS_PER_WEEK} y ${MAX_DAYS_PER_WEEK}.`,
    );
  }
  if (
    !Number.isInteger(input.sessionLengthMinutes) ||
    input.sessionLengthMinutes < MIN_SESSION_LENGTH_MINUTES ||
    input.sessionLengthMinutes > MAX_SESSION_LENGTH_MINUTES
  ) {
    throw new AppError(
      'VALIDATION',
      `La duración de la sesión debe estar entre ${MIN_SESSION_LENGTH_MINUTES} y ${MAX_SESSION_LENGTH_MINUTES} minutos.`,
    );
  }
  if (!LEVELS.includes(input.experience)) {
    throw new AppError('VALIDATION', 'El nivel de experiencia del brief no es válido.');
  }
  if (!isTextList(input.focusAreas, MAX_FOCUS_AREAS)) {
    throw new AppError('VALIDATION', 'Las áreas de enfoque del brief no son válidas.');
  }
  if (!isTextList(input.availableEquipment, MAX_EQUIPMENT_ENTRIES)) {
    throw new AppError('VALIDATION', 'El equipamiento disponible del brief no es válido.');
  }
  if (!Array.isArray(input.catalog) || input.catalog.length === 0) {
    throw new AppError('VALIDATION', EMPTY_CATALOG_MESSAGE);
  }
}

function toEngineDependencies(deps: WeeklyPlanComposerDependencies): RoutineDraftDependencies {
  return { fetchImpl: deps.fetchImpl, env: deps.env, timeoutMs: deps.timeoutMs };
}

/**
 * Composes one training day through the shared Routine Engine V2.
 *
 * @param input Weekly brief with goal, level, duration and the visible catalog.
 * @param day Strategy day with its focus and week placement.
 * @param engine Routine Engine V2 entry point shared with the routine composer.
 * @param engineDeps Optional fetch, environment and timeout overrides.
 * @param location Routine location inferred from the brief.
 * @returns The composed day with the engine exercises and the strategy focus.
 * @throws {AppError} When the engine returns an incomplete session.
 */
async function composeStrategyDay(
  input: WeeklyPlanComposerInput,
  day: WeeklyPlanStrategyDay,
  engine: WeeklyPlanRoutineEngine,
  engineDeps: RoutineDraftDependencies,
  location: RoutineDraftLocation,
): Promise<WeeklyPlanComposedDay> {
  const context: RoutineDraftContext = {
    goal: input.goal,
    focusAreas: day.focusAreas,
    location,
    level: input.experience,
    sessionLengthMinutes: input.sessionLengthMinutes,
    catalog: input.catalog,
  };
  const routine: RoutineDraft = await engine(context, engineDeps);
  if (routine.exercises.length === 0) {
    throw new AppError(
      'VALIDATION',
      `La rutina del día ${day.dayOfWeek} está incompleta: el motor de rutinas no devolvió ejercicios.`,
    );
  }

  return {
    dayOfWeek: day.dayOfWeek,
    title: day.title,
    focus: day.focus,
    focusAreas: day.focusAreas,
    routineSource: routine.source,
    exercises: routine.exercises.map((exercise, index) => ({ ...exercise, sortOrder: index })),
  };
}

async function composeStrategyWeek(
  input: WeeklyPlanComposerInput,
  strategy: WeeklyPlanStrategy,
  engine: WeeklyPlanRoutineEngine,
  engineDeps: RoutineDraftDependencies,
  location: RoutineDraftLocation,
): Promise<WeeklyPlanComposedWeek> {
  const days: WeeklyPlanComposedDay[] = [];
  for (const day of strategy.days) {
    days.push(await composeStrategyDay(input, day, engine, engineDeps, location));
  }
  return { days, restDays: strategy.restDays };
}

function toComposerDay(day: WeeklyPlanComposedDay): WeeklyPlanComposerDay {
  return {
    dayOfWeek: day.dayOfWeek,
    title: day.title,
    focus: day.focus,
    exercises: day.exercises,
  };
}

function toDraft(
  input: WeeklyPlanComposerInput,
  week: WeeklyPlanComposedWeek,
  strategy: WeeklyPlanStrategy,
): WeeklyPlanComposerDraft {
  const geminiContributed =
    strategy.source === 'gemini' || week.days.some((day) => day.routineSource === 'gemini');
  const goal = input.goal.trim();
  return {
    source: geminiContributed ? 'gemini' : 'fallback',
    name: `Coach Atlas · ${goal}`,
    goal,
    days: week.days.map(toComposerDay),
  };
}

function weeklyProposalError(
  strategy: WeeklyPlanStrategy,
  validation: WeeklyPlanValidationResult,
): AppError {
  const origin = strategy.source === 'gemini' ? 'Gemini' : 'la estrategia determinista';
  return new AppError(
    'VALIDATION',
    `La semana propuesta por ${origin} no es coherente. ${validation.reasons.join(' ')}`,
  );
}

/**
 * Composes a coherent week: one strategy, one routine per training day and whole-week validation.
 *
 * The strategy layer decides which weekdays train and with which focus, preferring coherent
 * Gemini output and falling back to the deterministic goal and focus aware distribution. Every
 * training day is delegated to the shared Routine Engine V2, and the whole week is validated
 * before it is returned. On a weekly validation failure the week is recomposed once with the
 * deterministic strategy; a partial proposal is never returned.
 *
 * @param input Weekly brief with goal, training days, experience, equipment, duration, focus and catalog.
 * @param deps Optional Routine Engine V2 override plus fetch, environment and timeout overrides.
 * @returns The weekly proposal with its provenance, ready to be previewed (never persisted).
 * @throws {AppError} When the brief is invalid, the engine fails or the week stays incoherent.
 * @example
 * const draft = await composeWeeklyPlanProposal({ goal: 'fuerza', daysPerWeek: 3, ...brief });
 * draft.days.length; // 3
 */
export async function composeWeeklyPlanProposal(
  input: WeeklyPlanComposerInput,
  deps: WeeklyPlanComposerDependencies = {},
): Promise<WeeklyPlanComposerDraft> {
  assertComposerBrief(input);

  const engine = deps.buildRoutineDraft ?? buildRoutineDraft;
  const engineDeps = toEngineDependencies(deps);
  const location = inferWeeklyLocation(input.availableEquipment);

  const strategy = await resolveWeeklyStrategy(input, engineDeps);
  const week = await composeStrategyWeek(input, strategy, engine, engineDeps, location);
  const validation = validateWeeklyProposal(week, input);
  if (validation.valid) return toDraft(input, week, strategy);

  if (strategy.source !== 'gemini') throw weeklyProposalError(strategy, validation);

  const deterministic = buildDeterministicWeeklyStrategy(input);
  const fallbackWeek = await composeStrategyWeek(input, deterministic, engine, engineDeps, location);
  const fallbackValidation = validateWeeklyProposal(fallbackWeek, input);
  if (fallbackValidation.valid) return toDraft(input, fallbackWeek, deterministic);

  throw weeklyProposalError(deterministic, fallbackValidation);
}
