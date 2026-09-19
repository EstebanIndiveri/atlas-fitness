import { describe, expect, it } from '@jest/globals';
import {
  addExercise,
  applyCatalogOwnership,
  draftFromRoutine,
  emptyDraft,
  moveExercise,
  removeExercise,
  toWritePayload,
  updateDraftExercise,
  validateDraft,
} from './form-state';
import { ROUTINE_COPY } from '@/lib/copy/routines';
import { MEDIA_URL_MAX_LENGTH } from '@/lib/validation/media-url';
import type { ExerciseCatalogItem } from '@/types/exercise';
import type { RoutineSummary } from '@/types/routine';

const bench: ExerciseCatalogItem = {
  id: 10,
  slug: 'bench-press',
  name: 'Press Banca',
  muscleGroup: 'Pecho',
  instructions: 'Bajá la barra.',
  imageUrl: 'https://cdn.example/bench.png',
  videoUrl: null,
  isSystem: true,
};

const squat: ExerciseCatalogItem = {
  id: 11,
  slug: 'squat',
  name: 'Sentadilla',
  muscleGroup: 'Piernas',
  instructions: 'Cadera atrás.',
  imageUrl: null,
  videoUrl: 'https://cdn.example/squat.mp4',
  isSystem: false,
};

const routine: RoutineSummary = {
  id: 1,
  slug: 'full-body',
  name: 'Full body',
  description: 'Rápida',
  kind: 'gym',
  restSeconds: 45,
  isSystem: true,
  exercises: [
    {
      id: 100,
      routineId: 1,
      exerciseId: 10,
      sortOrder: 0,
      targetSets: 3,
      targetReps: 8,
      exerciseName: 'Press Banca',
      muscleGroup: 'Pecho',
      instructions: 'x',
      imageUrl: null,
      videoUrl: null,
    },
  ],
};

describe('routine form state', () => {
  it('rejects an empty name and empty exercise list', () => {
    const result = validateDraft(emptyDraft());
    expect(result.ok).toBe(false);
    expect(result.name).toBe(ROUTINE_COPY.errorName);
    expect(result.exercises).toBe(ROUTINE_COPY.errorEmptyExercises);
  });

  it('adds, reorders and removes exercises with payload sortOrder', () => {
    let draft = emptyDraft();
    draft = { ...draft, name: 'Empuje' };
    const addedBench = addExercise(draft, bench, 'a');
    const addedSquat = addExercise(addedBench.draft, squat, 'b');
    expect(addedSquat.duplicate).toBe(false);
    expect(addExercise(addedSquat.draft, bench, 'c').duplicate).toBe(true);

    const moved = moveExercise(addedSquat.draft, 'b', 'up');
    expect(moved.exercises.map((item) => item.exerciseId)).toEqual([11, 10]);

    const removed = removeExercise(moved, 'a');
    const payload = toWritePayload(removed);
    expect(payload).toEqual({
      name: 'Empuje',
      description: null,
      kind: 'gym',
      restSeconds: 90,
      exercises: [{ exerciseId: 11, sortOrder: 0, targetSets: 3, targetReps: 10 }],
    });
  });

  it('validates sets/reps and hydrates catalog media + ownership', () => {
    const seeded = draftFromRoutine(routine);
    const withCatalog = applyCatalogOwnership(seeded, [bench]);
    expect(withCatalog.exercises[0]?.imageUrl).toBe('https://cdn.example/bench.png');
    expect(withCatalog.exercises[0]?.isSystem).toBe(true);

    const invalid = updateDraftExercise(withCatalog, withCatalog.exercises[0]!.clientId, {
      targetSets: 0,
      targetReps: 0,
    });
    const result = validateDraft(invalid);
    expect(result.ok).toBe(false);
    expect(result.items[withCatalog.exercises[0]!.clientId]).toEqual({
      targetSets: ROUTINE_COPY.errorSets,
      targetReps: ROUTINE_COPY.errorReps,
    });
  });

  it('rejects http media URLs (https-only scheme gate)', () => {
    const seeded = draftFromRoutine(routine);
    const withCatalog = applyCatalogOwnership(seeded, [bench]);
    const invalidMedia = updateDraftExercise(withCatalog, withCatalog.exercises[0]!.clientId, {
      imageUrl: 'http://cdn.example/insecure.png',
    });
    const mediaResult = validateDraft({ ...invalidMedia, name: 'Empuje' });
    expect(mediaResult.ok).toBe(false);
    expect(mediaResult.items[withCatalog.exercises[0]!.clientId]?.imageUrl).toBe(
      ROUTINE_COPY.mediaUrlHint,
    );
  });

  it('rejects media URLs longer than 2048 characters', () => {
    const seeded = draftFromRoutine(routine);
    const withCatalog = applyCatalogOwnership(seeded, [bench]);
    const tooLong = `https://cdn.example/${'a'.repeat(MEDIA_URL_MAX_LENGTH)}`;
    expect(tooLong.length).toBeGreaterThan(MEDIA_URL_MAX_LENGTH);
    const invalidMedia = updateDraftExercise(withCatalog, withCatalog.exercises[0]!.clientId, {
      imageUrl: tooLong,
    });
    const mediaResult = validateDraft({ ...invalidMedia, name: 'Empuje' });
    expect(mediaResult.ok).toBe(false);
    expect(mediaResult.items[withCatalog.exercises[0]!.clientId]?.imageUrl).toBe(
      ROUTINE_COPY.mediaUrlLengthHint,
    );
  });

  it('accepts https media URLs within 2048 characters', () => {
    const seeded = draftFromRoutine(routine);
    const withCatalog = applyCatalogOwnership(seeded, [bench]);
    const validMedia = updateDraftExercise(withCatalog, withCatalog.exercises[0]!.clientId, {
      imageUrl: 'https://cdn.example/ok.png',
      videoUrl: 'https://cdn.example/ok.mp4',
    });
    const mediaResult = validateDraft({ ...validMedia, name: 'Empuje' });
    expect(mediaResult.ok).toBe(true);
    expect(mediaResult.items[withCatalog.exercises[0]!.clientId]?.imageUrl).toBeUndefined();
    expect(mediaResult.items[withCatalog.exercises[0]!.clientId]?.videoUrl).toBeUndefined();
  });
});
