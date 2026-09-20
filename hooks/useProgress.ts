'use client';

import { useCallback, useEffect, useState } from 'react';

import { UI_COPY } from '@/lib/copy/ui';
import type { ProgressPeriod, ProgressSessionSummary, ProgressSummary } from '@/lib/services/progress-summary';
import type { WeekConsistency, WeekDayConsistency } from '@/types/week';

type UseProgressResult = {
  summary: ProgressSummary | null;
  week: WeekConsistency | null;
  loading: boolean;
  error: string | null;
  period: ProgressPeriod;
  setPeriod: (period: ProgressPeriod) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isProgressPeriod(value: unknown): value is ProgressPeriod {
  return value === 'week' || value === 'month' || value === 'quarter';
}

function isSessionSummary(value: unknown): value is ProgressSessionSummary {
  return (
    isRecord(value) &&
    Number.isInteger(value.workoutId) &&
    typeof value.startedAt === 'string' &&
    (Number.isInteger(value.durationMinutes) || value.durationMinutes === null) &&
    (typeof value.routineName === 'string' || value.routineName === null)
  );
}

function isProgressSummary(value: unknown): value is ProgressSummary {
  return (
    isRecord(value) &&
    isProgressPeriod(value.period) &&
    typeof value.fromLocalDate === 'string' &&
    typeof value.toLocalDate === 'string' &&
    Number.isInteger(value.completedSessions) &&
    Number.isInteger(value.totalDurationMinutes) &&
    Array.isArray(value.sessions) &&
    value.sessions.every(isSessionSummary)
  );
}

function isWeekDayConsistency(value: unknown): value is WeekDayConsistency {
  return (
    isRecord(value) &&
    typeof value.date === 'string' &&
    Number.isInteger(value.weekdayIndex) &&
    typeof value.active === 'boolean' &&
    typeof value.isToday === 'boolean' &&
    typeof value.isFuture === 'boolean'
  );
}

function isWeekConsistency(value: unknown): value is WeekConsistency {
  return (
    isRecord(value) &&
    typeof value.weekStart === 'string' &&
    typeof value.weekEnd === 'string' &&
    Number.isInteger(value.activeCount) &&
    Array.isArray(value.days) &&
    value.days.length === 7 &&
    value.days.every(isWeekDayConsistency)
  );
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(UI_COPY.progressError);
  }
  return response.json() as Promise<unknown>;
}

/**
 * Loads Progress tab data and re-fetches the summary when the selected period changes.
 *
 * @returns Progress summary, current week consistency, loading/error state and period controls.
 * @example
 * const { summary, week, period, setPeriod } = useProgress();
 */
export function useProgress(): UseProgressResult {
  const [period, setPeriod] = useState<ProgressPeriod>('month');
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [week, setWeek] = useState<WeekConsistency | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setLoading(true);
      try {
        const [summaryBody, weekBody] = await Promise.all([
          fetchJson(`/api/progress/summary?period=${period}`),
          fetchJson('/api/stats/week'),
        ]);
        if (!isProgressSummary(summaryBody) || !isWeekConsistency(weekBody)) {
          throw new Error(UI_COPY.progressError);
        }
        if (!cancelled) {
          setSummary(summaryBody);
          setWeek(weekBody);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setSummary(null);
          setWeek(null);
          setError(UI_COPY.progressError);
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
  }, [period]);

  const updatePeriod = useCallback((nextPeriod: ProgressPeriod): void => {
    setPeriod(nextPeriod);
  }, []);

  return { summary, week, loading, error, period, setPeriod: updatePeriod };
}
