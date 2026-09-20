'use client';

import { useCallback, useEffect, useState } from 'react';
import { TODAY_COPY } from '@/lib/copy/today';
import type { WeekConsistency, WeekDayConsistency } from '@/types/week';

function isWeekDayConsistency(value: unknown): value is WeekDayConsistency {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.date === 'string' &&
    typeof record.weekdayIndex === 'number' &&
    typeof record.active === 'boolean' &&
    typeof record.isToday === 'boolean' &&
    typeof record.isFuture === 'boolean'
  );
}

function isWeekConsistency(value: unknown): value is WeekConsistency {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.weekStart === 'string' &&
    typeof record.weekEnd === 'string' &&
    typeof record.activeCount === 'number' &&
    Array.isArray(record.days) &&
    record.days.length === 7 &&
    record.days.every(isWeekDayConsistency)
  );
}

interface UseWeekConsistencyResult {
  week: WeekConsistency | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Loads the current Córdoba week consistency snapshot from `/api/stats/week`.
 *
 * Mirrors {@link import('./useStreak').useStreak}: single fetch with loading and
 * error states plus an explicit `reload`. Values are validated before use so the
 * UI never renders an unsourced or malformed shape (DATA HONESTY RULE).
 * @returns Weekly consistency state for the Today Week card.
 */
export function useWeekConsistency(): UseWeekConsistencyResult {
  const [week, setWeek] = useState<WeekConsistency | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/stats/week');
        if (!response.ok) {
          throw new Error(TODAY_COPY.weekError);
        }
        const data: unknown = await response.json();
        if (!isWeekConsistency(data)) {
          throw new Error(TODAY_COPY.weekError);
        }
        if (!cancelled) {
          setWeek(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setWeek(null);
          setError(err instanceof Error ? err.message : TODAY_COPY.weekError);
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
  }, [requestId]);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setRequestId((current) => current + 1);
  }, []);

  return { week, loading, error, reload };
}
