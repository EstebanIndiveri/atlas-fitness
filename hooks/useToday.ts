'use client';

import { useCallback, useEffect, useState } from 'react';

import { fetchToday, TodayClientError, type TodayResponse } from '@/lib/api/today';
import { TODAY_COPY } from '@/lib/copy/today';

type UseTodayResult = {
  today: TodayResponse | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

function mapTodayError(error: unknown): string {
  if (error instanceof TodayClientError && error.kind === 'unauthorized') {
    return TODAY_COPY.todaySessionExpired;
  }

  return TODAY_COPY.todayError;
}

/**
 * Loads the authenticated user's Today state for client components.
 *
 * @returns Today data, loading/error state, and a reload callback.
 * @example
 * const { today, loading, error, reload } = useToday();
 */
export function useToday(): UseTodayResult {
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const data = await fetchToday();
        if (!cancelled) {
          setToday(data);
          setError(null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setToday(null);
          setError(mapTodayError(err));
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

  return { today, loading, error, reload };
}
