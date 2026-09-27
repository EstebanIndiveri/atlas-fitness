import type { ExerciseCatalogItem } from '@/types/exercise';
import type { RoutineKind } from '@/types/routine';

export type RoutineDraftSource = 'gemini' | 'fallback';
export type RoutineDraftLocation = RoutineKind;
export type RoutineDraftLevel = 'beginner' | 'intermediate' | 'advanced';

export type RoutineDraftCatalogItem = ExerciseCatalogItem & {
  equipment?: readonly string[];
  availableLocations?: readonly RoutineDraftLocation[];
};

export interface RoutineDraftContext {
  goal: string;
  focusAreas: readonly string[];
  location: RoutineDraftLocation;
  availableEquipment?: readonly string[];
  level: RoutineDraftLevel;
  sessionLengthMinutes: number;
  catalog: readonly RoutineDraftCatalogItem[];
}

/** @deprecated Use RoutineDraftContext with buildRoutineDraft. */
export interface RoutineDraftBrief {
  goal: string;
  daysPerWeek: number;
  location: RoutineDraftLocation;
  level: RoutineDraftLevel;
  focusAreas?: readonly string[];
  availableEquipment?: readonly string[];
  sessionLengthMinutes?: number;
}

export interface RoutineDraftExercise {
  exerciseId: number;
  exerciseName: string;
  muscleGroup: string;
  sortOrder: number;
  targetSets: number;
  targetReps: number;
  instructions?: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  equipment?: readonly string[];
}

export interface RoutineDraft {
  source: RoutineDraftSource;
  name: string;
  description: string;
  reason: string;
  kind: RoutineKind;
  restSeconds: number;
  exercises: RoutineDraftExercise[];
}

export type RoutineDraftDependencies = {
  fetchImpl?: typeof fetch;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
};
