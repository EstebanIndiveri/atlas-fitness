import type { ExerciseCatalogItem } from '@/types/exercise';
import type { RoutineExerciseItem, RoutineKind, RoutineSummary } from '@/types/routine';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === 'string' ? value : null;
}

function asKind(value: unknown): RoutineKind {
  return value === 'home' ? 'home' : 'gym';
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function parseRoutineExercise(value: unknown): RoutineExerciseItem | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = asNumber(value.id);
  const routineId = asNumber(value.routineId);
  const exerciseId = asNumber(value.exerciseId);
  const sortOrder = asNumber(value.sortOrder);
  const targetSets = asNumber(value.targetSets);
  const targetReps = asNumber(value.targetReps);
  if (
    id === null ||
    routineId === null ||
    exerciseId === null ||
    sortOrder === null ||
    targetSets === null ||
    targetReps === null ||
    typeof value.exerciseName !== 'string' ||
    typeof value.muscleGroup !== 'string' ||
    typeof value.instructions !== 'string'
  ) {
    return null;
  }

  return {
    id,
    routineId,
    exerciseId,
    sortOrder,
    targetSets,
    targetReps,
    exerciseName: value.exerciseName,
    muscleGroup: value.muscleGroup,
    instructions: value.instructions,
    imageUrl: asNullableString(value.imageUrl),
    videoUrl: asNullableString(value.videoUrl),
  };
}

export function parseRoutineSummary(value: unknown): RoutineSummary | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = asNumber(value.id);
  if (id === null || typeof value.slug !== 'string' || typeof value.name !== 'string') {
    return null;
  }
  if (!Array.isArray(value.exercises)) {
    return null;
  }
  const exercises: RoutineExerciseItem[] = [];
  for (const item of value.exercises) {
    const parsed = parseRoutineExercise(item);
    if (!parsed) {
      return null;
    }
    exercises.push(parsed);
  }

  const restSeconds = asNumber(value.restSeconds) ?? 90;
  if (typeof value.isSystem !== 'boolean') {
    return null;
  }
  return {
    id,
    slug: value.slug,
    name: value.name,
    description: asNullableString(value.description),
    kind: asKind(value.kind),
    restSeconds,
    isSystem: value.isSystem,
    exercises,
  };
}

export function parseRoutineList(value: unknown): RoutineSummary[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const list: RoutineSummary[] = [];
  for (const item of value) {
    const parsed = parseRoutineSummary(item);
    if (!parsed) {
      return null;
    }
    list.push(parsed);
  }
  return list;
}

export function parseExerciseCatalogItem(value: unknown): ExerciseCatalogItem | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = asNumber(value.id);
  if (
    id === null ||
    typeof value.slug !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.muscleGroup !== 'string' ||
    typeof value.instructions !== 'string' ||
    typeof value.isSystem !== 'boolean'
  ) {
    return null;
  }
  return {
    id,
    slug: value.slug,
    name: value.name,
    muscleGroup: value.muscleGroup,
    instructions: value.instructions,
    imageUrl: asNullableString(value.imageUrl),
    videoUrl: asNullableString(value.videoUrl),
    isSystem: value.isSystem,
  };
}

export function parseExerciseCatalog(value: unknown): ExerciseCatalogItem[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const list: ExerciseCatalogItem[] = [];
  for (const item of value) {
    const parsed = parseExerciseCatalogItem(item);
    if (!parsed) {
      return null;
    }
    list.push(parsed);
  }
  return list;
}
