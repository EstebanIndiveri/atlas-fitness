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
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/stats/streak');
        if (!response.ok) {
          throw new Error(STREAK_COPY.error);
        }
        const data: unknown = await response.json();
        if (!isStreakStats(data)) {
          throw new Error(STREAK_COPY.error);
        }
        if (!cancelled) {
          setStreak(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setStreak(null);
          setError(err instanceof Error ? err.message : STREAK_COPY.error);
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

  return { streak, loading, error, reload };
}
