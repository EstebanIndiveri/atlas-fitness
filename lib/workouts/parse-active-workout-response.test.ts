import { describe, expect, it } from '@jest/globals';
import { parseActiveWorkoutResponse } from './parse-active-workout-response';
import type { Workout } from '@/lib/db/schema';

const sampleWorkout = {
  id: 42,
  userId: 1,
  startedAt: new Date('2026-09-17T12:00:00.000Z'),
  endedAt: null,
  note: null,
  mood: null,
  deletedAt: null,
  routineId: null,
} satisfies Workout;

describe('parseActiveWorkoutResponse', () => {
  it('treats HTTP 200 with JSON null as no active workout', () => {
    expect(parseActiveWorkoutResponse(true, null)).toBeNull();
  });

  it('returns the workout when HTTP 200 and a workout body', () => {
    const parsed = parseActiveWorkoutResponse(true, sampleWorkout);
    expect(parsed).not.toBeNull();
    expect(parsed?.id).toBe(42);
  });

  it('treats non-OK responses as no active (legacy 404 and auth errors)', () => {
    expect(parseActiveWorkoutResponse(false, null)).toBeNull();
    expect(
      parseActiveWorkoutResponse(false, { code: 'UNAUTHORIZED', message: 'Authentication required' }),
    ).toBeNull();
  });

  it('does not treat an error-shaped JSON object as a workout', () => {
    expect(
      parseActiveWorkoutResponse(true, { code: 'UNAUTHORIZED', message: 'Authentication required' }),
    ).toBeNull();
  });
});
