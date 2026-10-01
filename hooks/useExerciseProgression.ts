'use client';

import { useCallback, useEffect, useState } from 'react';

import { fetchExerciseProgression } from '@/lib/api/exercise-progression';
import type { ProgressionQueryCohort } from '@/lib/api/exercise-progression';
import { PROGRESSION_COPY } from '@/lib/copy/exercise-progression';
import type { ExerciseProgression } from '@/types/progression-read';

/**
 * Loads the comparable progression read model for one explicit external cohort.
 *
 * A `null` cohort means the current visible context is not comparable in v0.12,
 * so nothing is requested and the panel renders a truthful unsupported state.
 */
export type ExerciseProgressionState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: ExerciseProgression }
  | { status: 'error'; message: string };

export interface UseExerciseProgressionInput {
  exerciseId: number;
  cohort: ProgressionQueryCohort | null;
}

export interface UseExerciseProgressionResult {
  state: ExerciseProgressionState;
  reload: () => void;
}

export function useExerciseProgression({
  exerciseId,
  cohort,
}: UseExerciseProgressionInput): UseExerciseProgressionResult {
  const [state, setState] = useState<ExerciseProgressionState>({ status: 'idle' });
  const [nonce, setNonce] = useState(0);
  const cohortKey = cohort ? `${cohort.reps}:${cohort.amountBasis}:${cohort.side}` : null;

  useEffect(() => {
    if (!cohort) {
      return;
    }

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: 'loading' });
    fetchExerciseProgression(exerciseId, cohort)
      .then((data) => {
        if (!cancelled) {
          setState({ status: 'ready', data });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: 'error', message: PROGRESSION_COPY.error });
        }
      });

    return () => {
      cancelled = true;
    };
    // `cohortKey` captures the exact requested cohort; `cohort` is derived from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId, cohortKey, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  // Without a comparable cohort nothing is requested and the panel decides its
  // truthful non-comparable copy; derive idle instead of mutating state.
  const effectiveState: ExerciseProgressionState = cohort ? state : { status: 'idle' };

  return { state: effectiveState, reload };
}
