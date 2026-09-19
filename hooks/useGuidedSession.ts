'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SESSION_COPY, motivatorForSet } from '@/lib/copy/session';
import {
  createClientMutationId,
  postWorkoutQueueAction,
  SessionQueueClientError,
} from '@/lib/session/client';
import { parseWorkoutQueueState } from '@/lib/session/parse-action';
import { completedExerciseIdsForRoutine } from '@/lib/session/progress';
import {
  applyComplete,
  emptyWorkoutQueue,
  queueItemsFromRoutine,
  reconcileWorkoutQueue,
  selectQueuedExercise,
} from '@/lib/session/queue';
import type { WorkoutSet } from '@/lib/db/schema';
import type { GuidedCloseSummary, NextExerciseSuggestion, RoutineSummary } from '@/types/routine';
import type { WorkoutQueueState } from '@/types/session-queue';

interface WorkoutPayload {
  id: number;
  routineId: number | null;
  endedAt: string | Date | null;
  sets: WorkoutSet[];
  queue?: unknown;
}

export function useGuidedSession(workoutId: string) {
  const [workout, setWorkout] = useState<WorkoutPayload | null>(null);
  const [routine, setRoutine] = useState<RoutineSummary | null>(null);
  const [queueOverride, setQueueOverride] = useState<WorkoutQueueState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [weight, setWeight] = useState('');
  const [suggestion, setSuggestion] = useState<NextExerciseSuggestion | null>(null);
  const [phase, setPhase] = useState<'train' | 'close'>('train');
  const [mood, setMood] = useState<number | null>(null);
  const [summary, setSummary] = useState<GuidedCloseSummary | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const workoutRes = await fetch(`/api/workouts/${workoutId}`);
    if (!workoutRes.ok) {
      throw new Error('workout');
    }
    const workoutData = (await workoutRes.json()) as WorkoutPayload;
    setWorkout(workoutData);

    if (workoutData.endedAt) {
      setPhase('close');
      const summaryRes = await fetch(`/api/workouts/${workoutData.id}/close-summary`);
      if (summaryRes.ok) {
        setSummary((await summaryRes.json()) as GuidedCloseSummary);
      }
    }

    if (!workoutData.routineId) {
      return workoutData;
    }

    const routineRes = await fetch(`/api/routines/${workoutData.routineId}`);
    if (!routineRes.ok) {
      throw new Error('routine');
    }
    const routineData = (await routineRes.json()) as RoutineSummary;
    setRoutine(routineData);
    return workoutData;
  }, [workoutId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch {
        if (!cancelled) setError('load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const completedIds = useMemo(() => {
    if (!routine || !workout) return [];
    return completedExerciseIdsForRoutine(routine, workout.sets);
  }, [routine, workout]);

  const queue = useMemo(() => {
    if (!routine) {
      return emptyWorkoutQueue();
    }
    return reconcileWorkoutQueue({
      orderedExerciseIds: routine.exercises.map((item) => item.exerciseId),
      completedExerciseIds: completedIds,
      previous: queueOverride,
      fromApi: workout ? parseWorkoutQueueState(workout.queue) : null,
    });
  }, [routine, workout, completedIds, queueOverride]);

  const current = useMemo(() => {
    if (!routine) return null;
    return selectQueuedExercise(routine.exercises, queue, suggestion?.nextExerciseId ?? null);
  }, [routine, queue, suggestion]);

  const completedCount = useMemo(() => {
    if (!current || !workout) return 0;
    return workout.sets.filter((set) => set.exerciseId === current.exerciseId).length;
  }, [current, workout]);

  const queueItems = useMemo(() => {
    if (!routine) return [];
    return queueItemsFromRoutine(routine.exercises, queue, current?.exerciseId ?? null);
  }, [routine, queue, current]);

  const enterCloseIfNeeded = useCallback(async (workoutNumericId: number, next: NextExerciseSuggestion) => {
    if (!(next.isLast && next.nextExerciseId === null)) {
      return false;
    }
    setPhase('close');
    const summaryRes = await fetch(`/api/workouts/${workoutNumericId}/close-summary`);
    if (summaryRes.ok) {
      setSummary((await summaryRes.json()) as GuidedCloseSummary);
    }
    return true;
  }, []);

  const completeSet = useCallback(async () => {
    if (!workout || !current || !routine) return;
    setBusy(true);
    setActionError(null);
    try {
      const setIndex = workout.sets.length
        ? Math.max(...workout.sets.map((set) => set.setIndex)) + 1
        : 1;
      const response = await fetch(`/api/workouts/${workout.id}/sets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exerciseId: current.exerciseId,
          setIndex,
          reps: current.targetReps,
          weightKg: weight,
        }),
      });
      if (!response.ok) {
        throw new Error('set');
      }
      const updated = await load();
      const nextCount = updated.sets.filter((set) => set.exerciseId === current.exerciseId).length;
      let wentToClose = false;
      if (nextCount >= current.targetSets) {
        setQueueOverride((previous) => applyComplete(previous ?? queue, current.exerciseId));
        const nextRes = await fetch(`/api/workouts/${workout.id}/next-exercise`, {
          method: 'POST',
        });
        if (nextRes.ok) {
          const nextData = (await nextRes.json()) as NextExerciseSuggestion;
          setSuggestion(nextData);
          wentToClose = await enterCloseIfNeeded(workout.id, nextData);
        } else {
          setPhase('close');
          wentToClose = true;
        }
      }
      return {
        completedExercise: nextCount >= current.targetSets,
        motivator: motivatorForSet(setIndex),
        wentToClose,
      };
    } finally {
      setBusy(false);
    }
  }, [workout, current, routine, weight, load, enterCloseIfNeeded, queue]);

  const runQueueAction = useCallback(
    async (action: 'skip' | 'hold') => {
      if (!workout || !current) return false;
      if (workout.endedAt) {
        setActionError(SESSION_COPY.errorNotActive);
        return false;
      }
      setBusy(true);
      setActionError(null);
      try {
        const result = await postWorkoutQueueAction({
          workoutId: workout.id,
          action,
          exerciseId: current.exerciseId,
          clientMutationId: createClientMutationId(),
        });
        setQueueOverride(result.queue);
        setSuggestion(result.suggestion);
        if (result.queue.pendingExerciseIds.length === 0) {
          await enterCloseIfNeeded(workout.id, {
            source: result.suggestion.source,
            isLast: true,
            nextExerciseId: null,
            message: result.suggestion.message,
          });
        } else {
          await enterCloseIfNeeded(workout.id, result.suggestion);
        }
        return true;
      } catch (caught) {
        if (caught instanceof SessionQueueClientError) {
          setActionError(caught.message);
        } else {
          setActionError(SESSION_COPY.errorQueueAction);
        }
        return false;
      } finally {
        setBusy(false);
      }
    },
    [workout, current, enterCloseIfNeeded],
  );

  const skipCurrent = useCallback(async () => runQueueAction('skip'), [runQueueAction]);
  const holdCurrent = useCallback(async () => runQueueAction('hold'), [runQueueAction]);

  const saveAndClose = useCallback(async () => {
    if (!workout || mood === null) return;
    setBusy(true);
    try {
      const patch = await fetch(`/api/workouts/${workout.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endedAt: new Date().toISOString(), mood }),
      });
      if (!patch.ok) {
        throw new Error('end');
      }
      const summaryRes = await fetch(`/api/workouts/${workout.id}/close-summary`);
      if (summaryRes.ok) {
        setSummary((await summaryRes.json()) as GuidedCloseSummary);
      }
      await load();
    } finally {
      setBusy(false);
    }
  }, [workout, mood, load]);

  return {
    loading,
    error,
    actionError,
    workout,
    routine,
    queue,
    queueItems,
    current,
    completedCount,
    weight,
    setWeight,
    busy,
    suggestion,
    phase,
    setPhase,
    mood,
    setMood,
    summary,
    completeSet,
    skipCurrent,
    holdCurrent,
    saveAndClose,
  };
}
