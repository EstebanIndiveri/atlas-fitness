export type CoachEnergyLevel = 'low' | 'medium' | 'high';
export type CoachRecommendationSource = 'deterministic' | 'ai';
export type CoachExerciseCategory = 'compound' | 'accessory';
export type CoachExerciseDeltaAction = 'kept' | 'reduced' | 'removed';

export interface CoachRoutineExerciseSummary {
  exerciseId: number;
  name: string;
  sets: number;
  isCompound?: boolean;
  category?: CoachExerciseCategory;
  muscleGroup?: string;
  sortOrder?: number;
}

export interface CoachAdaptationContext {
  routine: {
    exercises: CoachRoutineExerciseSummary[];
  };
  energy: CoachEnergyLevel;
  mood: 1 | 2 | 3 | 4 | 5;
  freeText?: string;
}

export interface CoachRoutineSummary {
  exerciseCount: number;
  setCount: number;
  estMinutes: number;
}

export interface CoachExerciseDelta {
  exerciseId: number;
  name: string;
  action: CoachExerciseDeltaAction;
  fromSets: number;
  toSets: number;
}

export interface CoachAdaptationResult {
  original: CoachRoutineSummary;
  adapted: CoachRoutineSummary;
  exerciseDeltas: CoachExerciseDelta[];
  reason: string;
  source: CoachRecommendationSource;
}
