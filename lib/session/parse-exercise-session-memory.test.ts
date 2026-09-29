import { describe, expect, it } from '@jest/globals';
import {
  parseExerciseSessionContext,
  parseExerciseSessionHistoricalSet,
  parseWorkoutExerciseNote,
} from './parse-exercise-session-memory';
import type {
  ExerciseSessionContext,
  WorkoutExerciseNote,
} from '@/types/exercise-session-memory';

const currentNote: WorkoutExerciseNote = {
  id: 5,
  userId: 1,
  workoutId: 10,
  exerciseId: 3,
  note: 'Foco en técnica, sin llegar al fallo',
  version: 2,
  createdAt: '2026-09-29T12:00:00.000Z',
  updatedAt: '2026-09-29T12:05:00.000Z',
};

const lastCompletedSets = {
  workoutId: 7,
  localDate: '2026-09-20',
  sets: [
    { id: 101, exerciseId: 3, setIndex: 1, reps: 8, weightKg: '40.5' },
    { id: 102, exerciseId: 3, setIndex: 2, reps: 8, weightKg: '40.5' },
  ],
};

const lastCompletedNote = {
  workoutId: 8,
  localDate: '2026-09-25',
  note: 'Mejor descanso entre series',
};

const context: ExerciseSessionContext = {
  workoutId: 10,
  exerciseId: 3,
  currentNote,
  lastCompletedSets,
  lastCompletedNote,
};

describe('parseWorkoutExerciseNote', () => {
  it('parses a valid note DTO', () => {
    expect(parseWorkoutExerciseNote(currentNote)).toEqual(currentNote);
  });

  it('accepts an astral note of exactly 280 code points', () => {
    const astral = '😀'.repeat(280);
    expect(parseWorkoutExerciseNote({ ...currentNote, note: astral })).toEqual({
      ...currentNote,
      note: astral,
    });
  });

  it('rejects an untrimmed, empty or 281-code-point note', () => {
    expect(parseWorkoutExerciseNote({ ...currentNote, note: ' x' })).toBeNull();
    expect(parseWorkoutExerciseNote({ ...currentNote, note: '' })).toBeNull();
    expect(parseWorkoutExerciseNote({ ...currentNote, note: '😀'.repeat(281) })).toBeNull();
  });

  it('rejects malformed ids and versions', () => {
    expect(parseWorkoutExerciseNote({ ...currentNote, id: 0 })).toBeNull();
    expect(parseWorkoutExerciseNote({ ...currentNote, id: 1.5 })).toBeNull();
    expect(parseWorkoutExerciseNote({ ...currentNote, id: '5' })).toBeNull();
    expect(parseWorkoutExerciseNote({ ...currentNote, userId: -1 })).toBeNull();
    expect(parseWorkoutExerciseNote({ ...currentNote, workoutId: 0 })).toBeNull();
    expect(parseWorkoutExerciseNote({ ...currentNote, exerciseId: 2.5 })).toBeNull();
    expect(parseWorkoutExerciseNote({ ...currentNote, version: 0 })).toBeNull();
    expect(parseWorkoutExerciseNote({ ...currentNote, version: 1.5 })).toBeNull();
    expect(parseWorkoutExerciseNote({ ...currentNote, version: '1' })).toBeNull();
  });

  it('rejects malformed timestamps', () => {
    expect(parseWorkoutExerciseNote({ ...currentNote, createdAt: 'ayer' })).toBeNull();
    expect(parseWorkoutExerciseNote({ ...currentNote, createdAt: '2026-09-29' })).toBeNull();
    expect(parseWorkoutExerciseNote({ ...currentNote, updatedAt: 1_756_000_000_000 })).toBeNull();
  });

  it('rejects unknown extra fields', () => {
    expect(parseWorkoutExerciseNote({ ...currentNote, recommendation: 'sube 5 kg' })).toBeNull();
    expect(parseWorkoutExerciseNote({ ...currentNote, delta: 2.5 })).toBeNull();
  });

  it('rejects non-object payloads', () => {
    expect(parseWorkoutExerciseNote(null)).toBeNull();
    expect(parseWorkoutExerciseNote(undefined)).toBeNull();
    expect(parseWorkoutExerciseNote('note')).toBeNull();
    expect(parseWorkoutExerciseNote([])).toBeNull();
  });
});

describe('parseExerciseSessionHistoricalSet', () => {
  it('preserves the decimal weight as an exact string', () => {
    const parsed = parseExerciseSessionHistoricalSet({
      id: 101,
      exerciseId: 3,
      setIndex: 1,
      reps: 8,
      weightKg: '40.50',
    });
    expect(parsed).toEqual({
      id: 101,
      exerciseId: 3,
      setIndex: 1,
      reps: 8,
      weightKg: '40.50',
    });
    expect(typeof parsed?.weightKg).toBe('string');
  });

  it('rejects numeric weight and malformed reps or set index', () => {
    expect(
      parseExerciseSessionHistoricalSet({
        id: 101,
        exerciseId: 3,
        setIndex: 1,
        reps: 8,
        weightKg: 40.5,
      }),
    ).toBeNull();
    expect(
      parseExerciseSessionHistoricalSet({
        id: 101,
        exerciseId: 3,
        setIndex: 1,
        reps: 0,
        weightKg: '40.5',
      }),
    ).toBeNull();
    expect(
      parseExerciseSessionHistoricalSet({
        id: 101,
        exerciseId: 3,
        setIndex: 1,
        reps: 8.5,
        weightKg: '40.5',
      }),
    ).toBeNull();
    expect(
      parseExerciseSessionHistoricalSet({
        id: 101,
        exerciseId: 3,
        setIndex: -1,
        reps: 8,
        weightKg: '40.5',
      }),
    ).toBeNull();
    expect(
      parseExerciseSessionHistoricalSet({
        id: 101,
        exerciseId: 3,
        setIndex: 1,
        reps: 8,
        weightKg: 'pesado',
      }),
    ).toBeNull();
  });

  it('rejects unknown extra fields', () => {
    expect(
      parseExerciseSessionHistoricalSet({
        id: 101,
        exerciseId: 3,
        setIndex: 1,
        reps: 8,
        weightKg: '40.5',
        completed: true,
      }),
    ).toBeNull();
  });
});

describe('parseExerciseSessionContext', () => {
  it('parses a full context round-trip', () => {
    expect(parseExerciseSessionContext(context)).toEqual(context);
  });

  it('parses an empty context', () => {
    const empty = {
      workoutId: 10,
      exerciseId: 3,
      currentNote: null,
      lastCompletedSets: null,
      lastCompletedNote: null,
    };
    expect(parseExerciseSessionContext(empty)).toEqual(empty);
  });

  it('keeps last-completed sets and note from independent workouts and dates', () => {
    const parsed = parseExerciseSessionContext(context);
    expect(parsed?.lastCompletedSets?.workoutId).toBe(7);
    expect(parsed?.lastCompletedSets?.localDate).toBe('2026-09-20');
    expect(parsed?.lastCompletedNote?.workoutId).toBe(8);
    expect(parsed?.lastCompletedNote?.localDate).toBe('2026-09-25');
    expect(parsed?.lastCompletedSets?.workoutId).not.toBe(parsed?.lastCompletedNote?.workoutId);
  });

  it('rejects a last-completed source pointing at the current workout', () => {
    expect(
      parseExerciseSessionContext({
        ...context,
        lastCompletedSets: { ...lastCompletedSets, workoutId: context.workoutId },
      }),
    ).toBeNull();
    expect(
      parseExerciseSessionContext({
        ...context,
        lastCompletedNote: { ...lastCompletedNote, workoutId: context.workoutId },
      }),
    ).toBeNull();
  });

  it('enforces exact exercise identity for current note and historical sets', () => {
    expect(
      parseExerciseSessionContext({
        ...context,
        currentNote: { ...currentNote, exerciseId: 99 },
      }),
    ).toBeNull();
    expect(
      parseExerciseSessionContext({
        ...context,
        currentNote: { ...currentNote, workoutId: 99 },
      }),
    ).toBeNull();
    expect(
      parseExerciseSessionContext({
        ...context,
        lastCompletedSets: {
          ...lastCompletedSets,
          sets: [{ ...lastCompletedSets.sets[0], exerciseId: 99 }],
        },
      }),
    ).toBeNull();
  });

  it('rejects an empty last-completed set list', () => {
    expect(
      parseExerciseSessionContext({
        ...context,
        lastCompletedSets: { ...lastCompletedSets, sets: [] },
      }),
    ).toBeNull();
  });

  it('rejects malformed historical dates', () => {
    expect(
      parseExerciseSessionContext({
        ...context,
        lastCompletedSets: { ...lastCompletedSets, localDate: '2026-9-1' },
      }),
    ).toBeNull();
    expect(
      parseExerciseSessionContext({
        ...context,
        lastCompletedNote: { ...lastCompletedNote, localDate: '2026-13-40' },
      }),
    ).toBeNull();
    expect(
      parseExerciseSessionContext({
        ...context,
        lastCompletedNote: { ...lastCompletedNote, localDate: 20260925 as unknown as string },
      }),
    ).toBeNull();
  });

  it('rejects non-decimal weight, malformed sets and unknown fields', () => {
    expect(
      parseExerciseSessionContext({
        ...context,
        lastCompletedSets: {
          ...lastCompletedSets,
          sets: [{ ...lastCompletedSets.sets[0], weightKg: 40.5 }],
        },
      }),
    ).toBeNull();
    expect(
      parseExerciseSessionContext({
        ...context,
        lastCompletedSets: {
          ...lastCompletedSets,
          sets: [{ ...lastCompletedSets.sets[0], reps: '8' }],
        },
      }),
    ).toBeNull();
    expect(parseExerciseSessionContext({ ...context, recommendation: 'sube 5 kg' })).toBeNull();
    expect(
      parseExerciseSessionContext({
        ...context,
        lastCompletedNote: { ...lastCompletedNote, trend: 'up' },
      }),
    ).toBeNull();
  });

  it('rejects a context missing a required key', () => {
    const { lastCompletedNote: _omitted, ...withoutNote } = context;
    void _omitted;
    expect(parseExerciseSessionContext(withoutNote)).toBeNull();
  });

  it('is total over unknown input', () => {
    expect(parseExerciseSessionContext(null)).toBeNull();
    expect(parseExerciseSessionContext(undefined)).toBeNull();
    expect(parseExerciseSessionContext('context')).toBeNull();
    expect(parseExerciseSessionContext(42)).toBeNull();
    expect(parseExerciseSessionContext([])).toBeNull();
  });
});
