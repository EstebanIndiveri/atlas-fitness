'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  HabitTargetAdherenceClientError,
  fetchHabitTargetAdherence,
} from '@/lib/api/habit-adherence';
import { HABIT_TARGET_COPY } from '@/lib/copy/habit-targets';
import type { HabitTargetAdherencePeriod, HabitTargetAdherenceWindow } from '@/types/habit-adherence';

interface AdherenceLoadState {
  period: HabitTargetAdherencePeriod;
  status: 'loading' | 'ready' | 'error';
  adherence: HabitTargetAdherenceWindow | null;
  error: string | null;
}

export interface UseHabitAdherenceResult {
  /** Window for the currently requested period; `null` while loading or after a failure. */
  adherence: HabitTargetAdherenceWindow | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Loads the honest target-adherence window of one Córdoba period.
 *
 * The window is keyed by period and cached per period, so switching back to an
 * already-read period shows its real numbers immediately instead of blanking to
 * a spinner, while a fresh request still lands. An abandoned request can never
 * overwrite the current period: a stale flag ignores its resolution (brief §9
 * Client: cache por periodo + abort de request obsoleto). This hook only maps
 * failures to copy; transport validation stays in the typed client.
 *
 * @param period - Córdoba window to read: current week, last 30 days, or last 90 days.
 * @param refreshKey - Changes after a target mutation so the window refetches.
 * @returns The window for `period` plus loading, error and reload state.
 * @example
 * const { adherence, loading, error, reload } = useHabitAdherence('week', revision);
 */
export function useHabitAdherence(
  period: HabitTargetAdherencePeriod,
  refreshKey = 0,
): UseHabitAdherenceResult {
  const cacheRef = useRef<
    Partial<Record<HabitTargetAdherencePeriod, HabitTargetAdherenceWindow>>
  >({});
  const [state, setState] = useState<AdherenceLoadState | null>(null);
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const cached = cacheRef.current[period];

    setState(
      cached === undefined
        ? { period, status: 'loading', adherence: null, error: null }
        : { period, status: 'ready', adherence: cached, error: null },
    );

    async function load(): Promise<void> {
      try {
        const adherence = await fetchHabitTargetAdherence(period);
        if (!cancelled) {
          cacheRef.current[period] = adherence;
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
                ? HABIT_TARGET_COPY.historySessionExpired
                : HABIT_TARGET_COPY.historyError,
          });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [period, refreshKey, requestId]);

  const reload = useCallback(() => {
    setRequestId((current) => current + 1);
  }, []);

  const current =
    state !== null && state.period === period
      ? state
      : { period, status: 'loading' as const, adherence: null, error: null };

  return {
    adherence: current.adherence,
    loading: current.status === 'loading',
    error: current.error,
    reload,
  };
}
