import { describe, expect, it } from '@jest/globals';
import { parseExerciseCatalog, parseRoutineList, parseRoutineSummary } from './parse-routine';

describe('parseRoutineSummary', () => {
  it('requires isSystem and keeps optional media URLs', () => {
    const parsed = parseRoutineSummary({
      id: 1,
      slug: 'full-body-expres',
      name: 'Full body exprés',
      description: null,
      kind: 'gym',
      restSeconds: 45,
      isSystem: true,
      exercises: [
        {
          id: 9,
          routineId: 1,
          exerciseId: 2,
          sortOrder: 0,
          targetSets: 1,
          targetReps: 5,
          exerciseName: 'Press Banca',
          muscleGroup: 'Pecho',
          instructions: 'x',
          imageUrl: null,
          videoUrl: 'https://example.com/v',
        },
      ],
    });
    expect(parsed?.name).toBe('Full body exprés');
    expect(parsed?.isSystem).toBe(true);
    expect(parsed?.exercises[0]?.videoUrl).toBe('https://example.com/v');
  });

  it('rejects a DTO missing required isSystem', () => {
    expect(
      parseRoutineSummary({
        id: 1,
        slug: 'own',
        name: 'Mía',
        description: 'x',
        kind: 'home',
        restSeconds: 30,
        exercises: [],
      }),
    ).toBeNull();
  });

  it('keeps isSystem when BE sends it', () => {
    const parsed = parseRoutineSummary({
      id: 1,
      slug: 'own',
      name: 'Mía',
      description: 'x',
      kind: 'home',
      restSeconds: 30,
      isSystem: false,
      exercises: [],
    });
    expect(parsed?.isSystem).toBe(false);
  });

  it('rejects payloads that are not routines', () => {
    expect(parseRoutineSummary({ id: '1' })).toBeNull();
    expect(parseRoutineList([{ id: 1 }])).toBeNull();
    expect(parseExerciseCatalog([{ id: 1, name: 'x' }])).toBeNull();
  });
});
