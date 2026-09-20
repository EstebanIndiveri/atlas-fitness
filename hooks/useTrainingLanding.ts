'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { fetchToday, type TodayResponse } from '@/lib/api/today';
import { UI_COPY } from '@/lib/copy/ui';
import type { Workout } from '@/lib/db/schema';
import { parseActiveWorkoutResponse } from '@/lib/workouts/parse-active-workout-response';
import type { RoutineExerciseItem, RoutineKind, RoutineSummary } from '@/types/routine';

export type UseTrainingLandingResult = {
  today: TodayResponse | null;
  routines: RoutineSummary[];
  activeWorkout: Workout | null;
  loading: boolean;
  error: string | null;
  starting: number | null;
  start: (routineId: number) => Promise<void>;
};

/**
 * Loads the Entrenar landing data and starts guided workouts.
 *
 * @returns Today plan, routines, active workout, UI state, and a start callback.
 * @throws Does not throw to callers; network and parsing failures are mapped to `error`.
 * @example
 * const { today, routines, start } = useTrainingLanding();
 */
export function useTrainingLanding(): UseTrainingLandingResult {
  const router = useRouter();
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [routines, setRoutines] = useState<RoutineSummary[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const [todayData, routinesData, activeData] = await Promise.all([
          fetchToday(),
          fetchRoutines(),
          fetchActiveWorkout(),
        ]);

        if (!cancelled) {
          setToday(todayData);
          setRoutines(routinesData);
          setActiveWorkout(activeData);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setToday(null);
          setRoutines([]);
          setActiveWorkout(null);
          setError(UI_COPY.training.errorLoad);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const start = useCallback(
    async (routineId: number): Promise<void> => {
      setStarting(routineId);
      setError(null);
      try {
        const response = await fetch('/api/workouts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ routineId }),
        });
        const body: unknown = await response.json();
        if (!response.ok || !isRecord(body) || !isInteger(body.id)) {
          throw new Error('Invalid workout start response');
        }
        router.push(`/dashboard/session/${body.id}`);
      } catch {
        setError(UI_COPY.training.errorLoad);
      } finally {
        setStarting(null);
      }
    },
    [router],
  );

  return { today, routines, activeWorkout, loading, error, starting, start };
}

async function fetchRoutines(): Promise<RoutineSummary[]> {
  const response = await fetch('/api/routines');
  if (!response.ok) {
    throw new Error('Unable to load routines');
  }
  const body: unknown = await response.json();
  if (!Array.isArray(body)) {
    return [];
  }
  return body.filter(isRoutineSummary);
}

async function fetchActiveWorkout(): Promise<Workout | null> {
  const response = await fetch('/api/workouts/active');
  const body: unknown = response.ok ? await response.json() : null;
  return parseActiveWorkoutResponse(response.ok, body);
}

function isRoutineSummary(value: unknown): value is RoutineSummary {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isInteger(value.id) &&
    typeof value.slug === 'string' &&
    typeof value.name === 'string' &&
    (typeof value.description === 'string' || value.description === null) &&
    isRoutineKind(value.kind) &&
    isInteger(value.restSeconds) &&
    typeof value.isSystem === 'boolean' &&
    Array.isArray(value.exercises) &&
    value.exercises.every(isRoutineExerciseItem)
  );
}

function isRoutineExerciseItem(value: unknown): value is RoutineExerciseItem {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isInteger(value.id) &&
    isInteger(value.routineId) &&
    isInteger(value.exerciseId) &&
    isInteger(value.sortOrder) &&
    isInteger(value.targetSets) &&
    isInteger(value.targetReps) &&
    typeof value.exerciseName === 'string' &&
    typeof value.muscleGroup === 'string' &&
    typeof value.instructions === 'string' &&
    (typeof value.imageUrl === 'string' || value.imageUrl === null) &&
    (typeof value.videoUrl === 'string' || value.videoUrl === null)
  );
}

function isRoutineKind(value: unknown): value is RoutineKind {
  return value === 'gym' || value === 'home';
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
