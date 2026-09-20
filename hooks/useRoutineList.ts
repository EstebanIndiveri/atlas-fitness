'use client';

import { useCallback, useEffect, useState } from 'react';
import { ROUTINE_COPY } from '@/lib/copy/routines';
import { deleteRoutine, fetchRoutines, RoutineClientError } from '@/lib/routines/client';
import type { RoutineSummary } from '@/types/routine';

function asClientError(error: unknown): RoutineClientError {
  if (error instanceof RoutineClientError) {
    return error;
  }
  return new RoutineClientError('generic', ROUTINE_COPY.errorLoad, 0);
}

export function useRoutineList() {
  const [routines, setRoutines] = useState<RoutineSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const list = await fetchRoutines();
        if (cancelled) return;
        setRoutines(list);
        setError(null);
      } catch (cause) {
        if (cancelled) return;
        setError(asClientError(cause).message);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  const reload = useCallback(() => {
    setRequestId((current) => current + 1);
  }, []);

  const remove = useCallback(async (id: number) => {
    if (typeof window !== 'undefined' && !window.confirm(ROUTINE_COPY.deleteConfirm)) {
      return false;
    }
    setDeletingId(id);
    try {
      await deleteRoutine(id);
      setRoutines((current) => (current ?? []).filter((item) => item.id !== id));
      setError(null);
      return true;
    } catch (cause) {
      setError(asClientError(cause).message);
      return false;
    } finally {
      setDeletingId(null);
    }
  }, []);

  return {
    routines: routines ?? [],
    loading: routines === null && error === null,
    error,
    deletingId,
    reload,
    remove,
  };
}
