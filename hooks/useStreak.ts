'use client';

import { useCallback, useEffect, useState } from 'react';
import { STREAK_COPY } from '@/lib/copy/streak';
import type { StreakStats } from '@/types/streak';

function isStreakStats(value: unknown): value is StreakStats {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.currentStreak === 'number' &&
    typeof record.longestStreak === 'number' &&
    (record.lastActiveDate === null || typeof record.lastActiveDate === 'string')
  );
}

export function useStreak() {
  const [streak, setStreak] = useState<StreakStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/stats/streak');
      if (!response.ok) {
        throw new Error(STREAK_COPY.error);
      }
      const data: unknown = await response.json();
      if (!isStreakStats(data)) {
        throw new Error(STREAK_COPY.error);
      }
      setStreak(data);
    } catch (err) {
      setStreak(null);
      setError(err instanceof Error ? err.message : STREAK_COPY.error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { streak, loading, error, reload };
}
