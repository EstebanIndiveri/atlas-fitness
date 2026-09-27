import type {
  RoutineDraft,
  RoutineDraftCatalogItem,
  RoutineDraftContext,
  RoutineDraftDependencies,
  RoutineDraftExercise,
  RoutineDraftLevel,
  RoutineDraftSource,
} from './routine-draft-types';

export type WeeklyPlanWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKLY_PLAN_WEEKDAYS: readonly WeeklyPlanWeekday[] = [0, 1, 2, 3, 4, 5, 6];

/** One scheduled training day of the weekly strategy: placement, focus and title. */
export interface WeeklyPlanStrategyDay {
  dayOfWeek: WeeklyPlanWeekday;
  title: string;
  focus: string;
  focusAreas: readonly string[];
}

/** Whole-week strategy: which weekdays train, with which focus, and which days rest. */
export interface WeeklyPlanStrategy {
  source: RoutineDraftSource;
  days: WeeklyPlanStrategyDay[];
  restDays: WeeklyPlanWeekday[];
}

export interface WeeklyPlanStrategyInput {
  goal: string;
  daysPerWeek: number;
  experience: RoutineDraftLevel;
  sessionLengthMinutes: number;
  availableEquipment: readonly string[];
  focusAreas: readonly string[];
  catalog: readonly RoutineDraftCatalogItem[];
}

export type WeeklyPlanStrategyDependencies = RoutineDraftDependencies;

/** Routine Engine V2 entry point: the shared session builder reused by every training day. */
export type WeeklyPlanRoutineEngine = (
  context: RoutineDraftContext,
  deps?: RoutineDraftDependencies,
) => Promise<RoutineDraft>;

/** Internal candidate day: engine output plus the strategy focus it was composed for. */
export interface WeeklyPlanComposedDay {
  dayOfWeek: WeeklyPlanWeekday;
  title: string;
  focus: string;
  focusAreas: readonly string[];
  routineSource: RoutineDraftSource;
  exercises: RoutineDraftExercise[];
}

/** Response day shape kept compatible with the existing weekly draft contract. */
export interface WeeklyPlanComposerDay {
  dayOfWeek: WeeklyPlanWeekday;
  title: string;
  focus: string;
  exercises: RoutineDraftExercise[];
}

export type WeeklyPlanComposerInput = WeeklyPlanStrategyInput;

export interface WeeklyPlanComposerDraft {
  source: RoutineDraftSource;
  name: string;
  goal: string;
  days: WeeklyPlanComposerDay[];
}

export interface WeeklyPlanComposerDependencies {
  buildRoutineDraft?: WeeklyPlanRoutineEngine;
  fetchImpl?: typeof fetch;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
}

export interface WeeklyPlanValidationProposal {
  days: readonly WeeklyPlanComposedDay[];
  restDays: readonly WeeklyPlanWeekday[];
}

export interface WeeklyPlanValidationInput {
  goal: string;
  daysPerWeek: number;
  sessionLengthMinutes: number;
  focusAreas: readonly string[];
  catalog: readonly RoutineDraftCatalogItem[];
}

export type WeeklyPlanValidationFailure =
  | 'training-day-count'
  | 'duplicate-weekday'
  | 'missing-recovery'
  | 'insufficient-recovery'
  | 'recovery-focus'
  | 'focus-coverage'
  | 'unrelated-focus'
  | 'repeated-exercise'
  | 'weekly-volume'
  | 'unknown-exercise';

export interface WeeklyPlanValidationResult {
  valid: boolean;
  failures: WeeklyPlanValidationFailure[];
  reasons: string[];
}
