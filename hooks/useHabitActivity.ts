'use client';

import { useCallback, useEffect, useState } from 'react';

import { fetchHabitActivity, HabitActivityClientError } from '@/lib/api/habit-activity';
import { PROGRESS_COPY } from '@/lib/copy/progress';
import { TODAY_COPY } from '@/lib/copy/today';
import type { HabitActivityPeriod, HabitActivityWindow } from '@/types/habit-activity';

interface HabitActivityLoadState {
  period: HabitActivityPeriod;
  status: 'loading' | 'ready' | 'error';
  activity: HabitActivityWindow | null;
  error: string | null;
}

export interface UseHabitActivityResult {
  /** Window for the currently requested period; `null` while loading or after a failure. */
  activity: HabitActivityWindow | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

function pendingState(period: HabitActivityPeriod): HabitActivityLoadState {
  return { period, status: 'loading', activity: null, error: null };
}

/**
 * Loads the read-only habit activity window of one Córdoba period.
 *
 * Mirrors {@link import('./useWeekConsistency').useWeekConsistency}: a single request per
 * period plus an explicit `reload`. Transport-shape validation stays in
 * {@link import('@/lib/api/habit-activity').fetchHabitActivity}; this hook only maps failures
 * to copy, so the response is never re-validated here.
 *
 * The loaded window is keyed by period, so switching periods never renders the previous
 * period's numbers while the new request is in flight (brief §15, defects #1 and #2).
 *
 * @param period Córdoba window to read: the current week, the last 30 days, or the last 90 days.
 * @returns The window for `period` plus loading, error and reload state.
 * @example
 * const { activity, loading, error, reload } = useHabitActivity(period);
 */
export function useHabitActivity(period: HabitActivityPeriod): UseHabitActivityResult {
  const [state, setState] = useState<HabitActivityLoadState | null>(null);
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const activity = await fetchHabitActivity(period);
        if (!cancelled) {
          setState({ period, status: 'ready', activity, error: null });
        }
      } catch (caught) {
        if (!cancelled) {
          setState({
            period,
            status: 'error',
            activity: null,
            error:
              caught instanceof HabitActivityClientError && caught.kind === 'unauthorized'
                ? TODAY_COPY.habitsSessionExpired
                : PROGRESS_COPY.habitActivity.unavailable,
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
    activity: current.activity,
    loading: current.status === 'loading',
    error: current.error,
    reload,
  };
}
