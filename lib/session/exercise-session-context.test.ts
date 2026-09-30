import { describe, expect, it } from '@jest/globals';
import {
  MAX_EXERCISE_NOTE_CODE_POINTS,
  parseExerciseSessionContext,
  parseExerciseSessionSet,
  parseLastCompletedExerciseNote,
  parseLastCompletedExerciseSets,
} from './exercise-session-memory';

const EXERCISE_ID = 42;

function validSet(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 501,
    exerciseId: EXERCISE_ID,
    setIndex: 1,
    reps: 8,
    weightKg: '82.5',
    semanticCaptureVersion: null,
    loadMode: null,
    amountBasis: null,
    side: null,
    setPurpose: null,
    repCountBasis: null,
    ...overrides,
  };
}

/** A complete v1 external/total/bilateral working set. */
function declaredSet(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return validSet({
    weightKg: '82.5',
    semanticCaptureVersion: 1,
    loadMode: 'external',
    amountBasis: 'total',
    side: 'bilateral',
    setPurpose: 'working',
    ...overrides,
  });
}

function validLastSets(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    workoutId: 90,
    exerciseId: EXERCISE_ID,
    localDate: '2026-09-28',
    endedAt: '2026-09-28T23:30:00.000Z',
    sets: [validSet(), validSet({ id: 502, setIndex: 2, reps: 6, weightKg: '80' })],
    ...overrides,
  };
}

function validLastNote(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    workoutId: 77,
    exerciseId: EXERCISE_ID,
    localDate: '2026-09-24',
    endedAt: '2026-09-24T22:00:00.000Z',
    noteId: 12,
    note: 'Última vez sentí liviano',
    version: 3,
    ...overrides,
  };
}

function validContext(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    workoutId: 200,
    exerciseId: EXERCISE_ID,
    currentNote: {
      id: 8,
      userId: 3,
      workoutId: 200,
      exerciseId: EXERCISE_ID,
      note: 'Hoy 3 series',
      version: 1,
      createdAt: '2026-09-29T10:00:00.000Z',
      updatedAt: '2026-09-29T10:00:00.000Z',
    },
    lastCompletedSets: validLastSets(),
    lastCompletedNote: validLastNote(),
    ...overrides,
  };
}

describe('parseExerciseSessionSet', () => {
  it('keeps the weight as the exact raw decimal string', () => {
    expect(parseExerciseSessionSet(validSet({ weightKg: '80.50' }))?.weightKg).toBe('80.50');
    expect(parseExerciseSessionSet(validSet({ weightKg: '80.5' }))?.weightKg).toBe('80.5');
  });

  it('rejects a numeric weight instead of coercing it', () => {
    expect(parseExerciseSessionSet(validSet({ weightKg: 80.5 }))).toBeNull();
  });

  it('rejects malformed weights, reps and set indexes', () => {
    expect(parseExerciseSessionSet(validSet({ weightKg: 'abc' }))).toBeNull();
    expect(parseExerciseSessionSet(validSet({ weightKg: '' }))).toBeNull();
    expect(parseExerciseSessionSet(validSet({ weightKg: '-5' }))).toBeNull();
    expect(parseExerciseSessionSet(validSet({ reps: 0 }))).toBeNull();
    expect(parseExerciseSessionSet(validSet({ reps: 8.5 }))).toBeNull();
    expect(parseExerciseSessionSet(validSet({ setIndex: 0 }))).toBeNull();
  });

  it('rejects unknown fields', () => {
    expect(parseExerciseSessionSet(validSet({ rpe: 8 }))).toBeNull();
    expect(parseExerciseSessionSet(validSet({ completed: true }))).toBeNull();
  });

  it('keeps a legacy all-null tuple as an explicit unknown', () => {
    const parsed = parseExerciseSessionSet(validSet());
    expect(parsed).not.toBeNull();
    expect(parsed?.semanticCaptureVersion).toBeNull();
    expect(parsed?.loadMode).toBeNull();
  });

  it('accepts a declared bodyweight zero sentinel without inferring load', () => {
    const parsed = parseExerciseSessionSet(
      declaredSet({
        weightKg: '0',
        loadMode: 'bodyweight',
        amountBasis: null,
        side: 'bilateral',
        setPurpose: 'working',
      }),
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.weightKg).toBe('0');
    expect(parsed?.loadMode).toBe('bodyweight');
  });

  it('accepts declared assisted and per-side rows', () => {
    const assisted = parseExerciseSessionSet(
      declaredSet({
        weightKg: '30',
        loadMode: 'assisted',
        amountBasis: 'total',
        setPurpose: 'working',
      }),
    );
    expect(assisted?.loadMode).toBe('assisted');

    const perSide = parseExerciseSessionSet(
      declaredSet({
        weightKg: '20',
        loadMode: 'external',
        amountBasis: 'per_side',
      }),
    );
    expect(perSide?.amountBasis).toBe('per_side');
  });

  it('rejects a non-zero bodyweight amount and a declared zero external amount', () => {
    expect(
      parseExerciseSessionSet(
        declaredSet({ weightKg: '5', loadMode: 'bodyweight', amountBasis: null }),
      ),
    ).toBeNull();
    expect(parseExerciseSessionSet(declaredSet({ weightKg: '0' }))).toBeNull();
  });

  it('rejects a partial or corrupt semantic tuple instead of inferring it', () => {
    // Declared version but a missing required field.
    expect(
      parseExerciseSessionSet(
        declaredSet({ loadMode: null }),
      ),
    ).toBeNull();
    // Legacy version null but a stray semantic field.
    expect(parseExerciseSessionSet(validSet({ loadMode: 'external' }))).toBeNull();
    // Unknown enum value.
    expect(parseExerciseSessionSet(declaredSet({ loadMode: 'magic' }))).toBeNull();
    // Structurally invalid combination: left side with per_side.
    expect(
      parseExerciseSessionSet(declaredSet({ side: 'left', amountBasis: 'per_side' })),
    ).toBeNull();
  });
});

describe('parseLastCompletedExerciseSets', () => {
  it('parses raw ordered sets for the exact exercise', () => {
    const parsed = parseLastCompletedExerciseSets(validLastSets());
    expect(parsed).not.toBeNull();
    expect(parsed?.workoutId).toBe(90);
    expect(parsed?.exerciseId).toBe(EXERCISE_ID);
    expect(parsed?.localDate).toBe('2026-09-28');
    expect(parsed?.sets.map((set) => set.weightKg)).toEqual(['82.5', '80']);
  });

  it('rejects an empty set list', () => {
    expect(parseLastCompletedExerciseSets(validLastSets({ sets: [] }))).toBeNull();
  });

  it('rejects sets belonging to a different exercise identity', () => {
    expect(
      parseLastCompletedExerciseSets(validLastSets({ sets: [validSet({ exerciseId: 99 })] })),
    ).toBeNull();
    expect(parseLastCompletedExerciseSets(validLastSets({ exerciseId: 99 }))).toBeNull();
  });

  it('rejects malformed dates', () => {
    expect(parseLastCompletedExerciseSets(validLastSets({ localDate: '2026-9-28' }))).toBeNull();
    expect(parseLastCompletedExerciseSets(validLastSets({ localDate: '2026-02-30' }))).toBeNull();
    expect(parseLastCompletedExerciseSets(validLastSets({ endedAt: '2026-09-28' }))).toBeNull();
  });

  it('rejects a Córdoba date that does not match the endedAt instant', () => {
    // 02:30 UTC on the 28th is 23:30 on the 27th in Córdoba (UTC-3).
    expect(
      parseLastCompletedExerciseSets(
        validLastSets({ endedAt: '2026-09-28T02:30:00.000Z', localDate: '2026-09-28' }),
      ),
    ).toBeNull();
    expect(
      parseLastCompletedExerciseSets(
        validLastSets({ endedAt: '2026-09-28T02:30:00.000Z', localDate: '2026-09-27' }),
      ),
    ).not.toBeNull();
  });

  it('rejects unknown fields', () => {
    expect(parseLastCompletedExerciseSets(validLastSets({ volumeKg: '100' }))).toBeNull();
  });
});

describe('parseLastCompletedExerciseNote', () => {
  it('parses the frozen historical note with its own workout and date', () => {
    expect(parseLastCompletedExerciseNote(validLastNote())).toEqual({
      workoutId: 77,
      exerciseId: EXERCISE_ID,
      localDate: '2026-09-24',
      endedAt: '2026-09-24T22:00:00.000Z',
      noteId: 12,
      note: 'Última vez sentí liviano',
      version: 3,
    });
  });

  it('preserves the exact exercise identity carried by the source', () => {
    expect(parseLastCompletedExerciseNote(validLastNote({ exerciseId: 99 }))?.exerciseId).toBe(99);
  });

  it('rejects malformed note text and version', () => {
    expect(parseLastCompletedExerciseNote(validLastNote({ note: '  ' }))).toBeNull();
    expect(
      parseLastCompletedExerciseNote(
        validLastNote({ note: 'a'.repeat(MAX_EXERCISE_NOTE_CODE_POINTS + 1) }),
      ),
    ).toBeNull();
    expect(parseLastCompletedExerciseNote(validLastNote({ version: 0 }))).toBeNull();
  });

  it('rejects unknown fields', () => {
    expect(parseLastCompletedExerciseNote(validLastNote({ sensation: 'good' }))).toBeNull();
  });
});

describe('parseExerciseSessionContext', () => {
  it('accepts an empty context with no current note and no history', () => {
    expect(
      parseExerciseSessionContext({
        workoutId: 200,
        exerciseId: EXERCISE_ID,
        currentNote: null,
        lastCompletedSets: null,
        lastCompletedNote: null,
      }),
    ).toEqual({
      workoutId: 200,
      exerciseId: EXERCISE_ID,
      currentNote: null,
      lastCompletedSets: null,
      lastCompletedNote: null,
    });
  });

  it('keeps the current note, last sets and last note as separate sources', () => {
    const parsed = parseExerciseSessionContext(validContext());
    expect(parsed?.currentNote?.workoutId).toBe(200);
    expect(parsed?.lastCompletedSets?.workoutId).toBe(90);
    expect(parsed?.lastCompletedNote?.workoutId).toBe(77);
    expect(parsed?.lastCompletedSets?.localDate).toBe('2026-09-28');
    expect(parsed?.lastCompletedNote?.localDate).toBe('2026-09-24');
  });

  it('never accepts the current workout as lastCompleted', () => {
    expect(
      parseExerciseSessionContext(
        validContext({ lastCompletedSets: validLastSets({ workoutId: 200 }) }),
      ),
    ).toBeNull();
    expect(
      parseExerciseSessionContext(
        validContext({ lastCompletedNote: validLastNote({ workoutId: 200 }) }),
      ),
    ).toBeNull();
  });

  it('rejects historical context for a different exercise identity', () => {
    expect(
      parseExerciseSessionContext(
        validContext({ lastCompletedSets: validLastSets({ exerciseId: 99 }) }),
      ),
    ).toBeNull();
    expect(
      parseExerciseSessionContext(
        validContext({ lastCompletedNote: validLastNote({ exerciseId: 99 }) }),
      ),
    ).toBeNull();
  });

  it('rejects a current note that does not belong to the requested workout/exercise', () => {
    expect(
      parseExerciseSessionContext(
        validContext({
          currentNote: {
            id: 8,
            userId: 3,
            workoutId: 999,
            exerciseId: EXERCISE_ID,
            note: 'Hoy 3 series',
            version: 1,
            createdAt: '2026-09-29T10:00:00.000Z',
            updatedAt: '2026-09-29T10:00:00.000Z',
          },
        }),
      ),
    ).toBeNull();
  });

  it('rejects unknown fields at context and source level', () => {
    expect(parseExerciseSessionContext(validContext({ readiness: 'ready' }))).toBeNull();
    expect(
      parseExerciseSessionContext(validContext({ lastCompletedSets: validLastSets({ pr: true }) })),
    ).toBeNull();
  });

  it('rejects malformed top-level ids', () => {
    expect(parseExerciseSessionContext(validContext({ workoutId: 0 }))).toBeNull();
    expect(parseExerciseSessionContext(validContext({ exerciseId: '42' }))).toBeNull();
  });
});
