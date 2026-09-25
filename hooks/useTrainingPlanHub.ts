'use client';

import { useEffect, useState } from 'react';

import {
  getTrainingPlanHub,
  TrainingPlanHubClientError,
} from '@/lib/api/training-plan-hub';
import type { TrainingPlanHubDto } from '@/types/training-plan-hub';

export type TrainingPlanHubState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: TrainingPlanHubDto; error: null }
  | { status: 'not_found'; data: null; error: null }
  | { status: 'error'; data: null; error: string };

/**
 * Loads one plan hub and maps API errors to explicit user-facing states.
 *
 * @param planId - Positive persisted plan id.
 * @returns Loading, ready, not-found, or error state for the requested plan.
 * @example
 * const state = useTrainingPlanHub(planId);
 */
export function useTrainingPlanHub(planId: number): TrainingPlanHubState {
  const [loadedState, setLoadedState] = useState<{
    planId: number;
    state: TrainingPlanHubState;
  }>(() => ({
    planId,
    state: { status: 'loading', data: null, error: null },
  }));

  useEffect(() => {
    let cancelled = false;

    getTrainingPlanHub(planId)
      .then((data) => {
        if (!cancelled) {
          setLoadedState({
            planId,
            state: { status: 'ready', data, error: null },
          });
        }
      })
      .catch((cause: unknown) => {
        if (cancelled) {
          return;
        }
        if (cause instanceof TrainingPlanHubClientError && cause.kind === 'not_found') {
          setLoadedState({
            planId,
            state: { status: 'not_found', data: null, error: null },
          });
          return;
        }

        setLoadedState({
          planId,
          state: {
            status: 'error',
            data: null,
            error:
              cause instanceof Error
                ? cause.message
                : 'No pudimos cargar tu plan. Probá de nuevo.',
          },
        });
      });

    return () => {
      cancelled = true;
    };
  }, [planId]);

  return loadedState.planId === planId
    ? loadedState.state
    : { status: 'loading', data: null, error: null };
}
