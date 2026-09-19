import { ROUTINE_COPY } from '@/lib/copy/routines';
import type { ExerciseCatalogItem } from '@/types/exercise';
import type { RoutineKind, RoutineSummary, RoutineWriteInput } from '@/types/routine';

export const DEFAULT_REST_SECONDS = 90;
export const MIN_NAME_LENGTH = 2;

export type DraftExercise = {
  clientId: string;
  exerciseId: number;
  exerciseName: string;
  muscleGroup: string;
  instructions: string;
  imageUrl: string | null;
  videoUrl: string | null;
  isSystem: boolean;
  targetSets: number;
  targetReps: number;
};

export type RoutineDraft = {
  name: string;
  description: string;
  kind: RoutineKind;
  restSeconds: number;
  exercises: DraftExercise[];
};

export type DraftItemErrors = {
  targetSets?: string;
  targetReps?: string;
  imageUrl?: string;
  videoUrl?: string;
};

export type DraftValidation = {
  ok: boolean;
  name?: string;
  restSeconds?: string;
  exercises?: string;
  items: Record<string, DraftItemErrors>;
};

export function emptyDraft(): RoutineDraft {
  return {
    name: '',
    description: '',
    kind: 'gym',
    restSeconds: DEFAULT_REST_SECONDS,
    exercises: [],
  };
}

export function draftFromRoutine(routine: RoutineSummary): RoutineDraft {
  return {
    name: routine.name,
    description: routine.description ?? '',
    kind: routine.kind,
    restSeconds: routine.restSeconds,
    exercises: routine.exercises.map((item, index) => ({
      clientId: `saved-${item.id}-${index}`,
      exerciseId: item.exerciseId,
      exerciseName: item.exerciseName,
      muscleGroup: item.muscleGroup,
      instructions: item.instructions,
      imageUrl: item.imageUrl,
      videoUrl: item.videoUrl,
      isSystem: true,
      targetSets: item.targetSets,
      targetReps: item.targetReps,
    })),
  };
}

export function applyCatalogOwnership(
  draft: RoutineDraft,
  catalog: readonly ExerciseCatalogItem[],
): RoutineDraft {
  const byId = new Map(catalog.map((item) => [item.id, item]));
  return {
    ...draft,
    exercises: draft.exercises.map((exercise) => {
      const catalogItem = byId.get(exercise.exerciseId);
      if (!catalogItem) {
        return exercise;
      }
      return {
        ...exercise,
        exerciseName: catalogItem.name,
        muscleGroup: catalogItem.muscleGroup,
        instructions: catalogItem.instructions,
        imageUrl: catalogItem.imageUrl,
        videoUrl: catalogItem.videoUrl,
        isSystem: catalogItem.isSystem,
      };
    }),
  };
}

export function toWritePayload(draft: RoutineDraft): RoutineWriteInput {
  return {
    name: draft.name.trim(),
    description: draft.description.trim() ? draft.description.trim() : null,
    kind: draft.kind,
    restSeconds: draft.restSeconds,
    exercises: draft.exercises.map((exercise, index) => ({
      exerciseId: exercise.exerciseId,
      sortOrder: index,
      targetSets: exercise.targetSets,
      targetReps: exercise.targetReps,
    })),
  };
}

export function addExercise(
  draft: RoutineDraft,
  item: ExerciseCatalogItem,
  clientId: string,
): { draft: RoutineDraft; duplicate: boolean } {
  if (draft.exercises.some((exercise) => exercise.exerciseId === item.id)) {
    return { draft, duplicate: true };
  }

  const next: DraftExercise = {
    clientId,
    exerciseId: item.id,
    exerciseName: item.name,
    muscleGroup: item.muscleGroup,
    instructions: item.instructions,
    imageUrl: item.imageUrl,
    videoUrl: item.videoUrl,
    isSystem: item.isSystem,
    targetSets: 3,
    targetReps: 10,
  };

  return {
    draft: { ...draft, exercises: [...draft.exercises, next] },
    duplicate: false,
  };
}

export function removeExercise(draft: RoutineDraft, clientId: string): RoutineDraft {
  return {
    ...draft,
    exercises: draft.exercises.filter((exercise) => exercise.clientId !== clientId),
  };
}

export function moveExercise(
  draft: RoutineDraft,
  clientId: string,
  direction: 'up' | 'down',
): RoutineDraft {
  const index = draft.exercises.findIndex((exercise) => exercise.clientId === clientId);
  if (index < 0) {
    return draft;
  }
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= draft.exercises.length) {
    return draft;
  }
  const exercises = [...draft.exercises];
  const [removed] = exercises.splice(index, 1);
  exercises.splice(target, 0, removed);
  return { ...draft, exercises };
}

export function updateDraftMeta(
  draft: RoutineDraft,
  patch: Partial<Pick<RoutineDraft, 'name' | 'description' | 'kind' | 'restSeconds'>>,
): RoutineDraft {
  return { ...draft, ...patch };
}

export function updateDraftExercise(
  draft: RoutineDraft,
  clientId: string,
  patch: Partial<Pick<DraftExercise, 'targetSets' | 'targetReps' | 'imageUrl' | 'videoUrl'>>,
): RoutineDraft {
  return {
    ...draft,
    exercises: draft.exercises.map((exercise) =>
      exercise.clientId === clientId ? { ...exercise, ...patch } : exercise,
    ),
  };
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function optionalUrlError(value: string | null): string | undefined {
  if (value === null || value.trim() === '') {
    return undefined;
  }
  return isHttpUrl(value.trim()) ? undefined : ROUTINE_COPY.mediaUrlHint;
}

export function validateDraft(draft: RoutineDraft): DraftValidation {
  const items: Record<string, DraftItemErrors> = {};
  const name = draft.name.trim().length < MIN_NAME_LENGTH ? ROUTINE_COPY.errorName : undefined;
  const restSeconds =
    !Number.isInteger(draft.restSeconds) || draft.restSeconds < 0 ? ROUTINE_COPY.errorRest : undefined;
  const exercises = draft.exercises.length === 0 ? ROUTINE_COPY.errorEmptyExercises : undefined;

  for (const exercise of draft.exercises) {
    const item: DraftItemErrors = {};
    if (!Number.isInteger(exercise.targetSets) || exercise.targetSets < 1) {
      item.targetSets = ROUTINE_COPY.errorSets;
    }
    if (!Number.isInteger(exercise.targetReps) || exercise.targetReps < 1) {
      item.targetReps = ROUTINE_COPY.errorReps;
    }
    const imageUrlError = optionalUrlError(exercise.imageUrl);
    if (imageUrlError) item.imageUrl = imageUrlError;
    const videoUrlError = optionalUrlError(exercise.videoUrl);
    if (videoUrlError) item.videoUrl = videoUrlError;
    if (Object.keys(item).length > 0) {
      items[exercise.clientId] = item;
    }
  }

  return {
    ok: !name && !restSeconds && !exercises && Object.keys(items).length === 0,
    name,
    restSeconds,
    exercises,
    items,
  };
}

export function isRoutineReadOnly(routine: Pick<RoutineSummary, 'isSystem'> | null): boolean {
  return routine?.isSystem === true;
}
