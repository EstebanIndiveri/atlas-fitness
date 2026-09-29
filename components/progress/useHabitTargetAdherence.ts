'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  fetchHabitTargetAdherence,
  HabitTargetAdherenceClientError,
} from '@/lib/api/habit-adherence';
import { PROGRESS_COPY } from '@/lib/copy/progress';
import { TODAY_COPY } from '@/lib/copy/today';
import type {
  HabitTargetAdherencePeriod,
  HabitTargetAdherenceWindow,
} from '@/types/habit-adherence';

interface HabitTargetAdherenceLoadState {
  period: HabitTargetAdherencePeriod;
  status: 'loading' | 'ready' | 'error';
  adherence: HabitTargetAdherenceWindow | null;
  error: string | null;
}

export interface UseHabitTargetAdherenceResult {
  /** Adherence window for the currently requested period; `null` while loading or after a failure. */
  adherence: HabitTargetAdherenceWindow | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

function pendingState(period: HabitTargetAdherencePeriod): HabitTargetAdherenceLoadState {
  return { period, status: 'loading', adherence: null, error: null };
}

/**
 * Loads the read-only target-adherence window of one Córdoba period.
 *
 * Deliberately a Progress-local hook: it consumes the shared adherence client
 * directly and never re-validates the transport, which stays in
 * {@link import('@/lib/api/habit-adherence').fetchHabitTargetAdherence}. The loaded
 * window is keyed by period, so switching periods never renders the previous
 * period's counts while the new request is in flight. It is intentionally
 * separate from {@link import('@/hooks/useHabitActivity').useHabitActivity} so
 * observed activity and target adherence keep independent loading and error states.
 *
 * @param period Córdoba window to read: the current week, the last 30 days, or the last 90 days.
 * @returns The adherence window for `period` plus loading, error and reload state.
 * @example
 * const { adherence, loading, error, reload } = useHabitTargetAdherence('month');
 */
export function useHabitTargetAdherence(
  period: HabitTargetAdherencePeriod,
): UseHabitTargetAdherenceResult {
  const [state, setState] = useState<HabitTargetAdherenceLoadState | null>(null);
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const adherence = await fetchHabitTargetAdherence(period);
        if (!cancelled) {
          setState({ period, status: 'ready', adherence, error: null });
        }
      } catch (caught) {
        if (!cancelled) {
          setState({
            period,
            status: 'error',
            adherence: null,
            error:
              caught instanceof HabitTargetAdherenceClientError && caught.kind === 'unauthorized'
                ? TODAY_COPY.habitsSessionExpired
                : PROGRESS_COPY.habitTarget.unavailable,
          });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [period, requestId]);

  const reload = useCallback(() => {
    setState(pendingState(period));
    setRequestId((current) => current + 1);
  }, [period]);

  const current = state !== null && state.period === period ? state : pendingState(period);

  return {
    adherence: current.adherence,
    loading: current.status === 'loading',
    error: current.error,
    reload,
  };
}
