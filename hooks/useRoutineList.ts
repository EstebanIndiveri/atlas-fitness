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
  const [routines, setRoutines] = useState<RoutineSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchRoutines();
      setRoutines(list);
      setError(null);
    } catch (cause) {
      setError(asClientError(cause).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = useCallback(async (id: number) => {
    if (typeof window !== 'undefined' && !window.confirm(ROUTINE_COPY.deleteConfirm)) {
      return false;
    }
    setDeletingId(id);
    try {
      await deleteRoutine(id);
      setRoutines((current) => current.filter((item) => item.id !== id));
      setError(null);
      return true;
    } catch (cause) {
      setError(asClientError(cause).message);
      return false;
    } finally {
      setDeletingId(null);
    }
  }, []);

  return { routines, loading, error, deletingId, reload: load, remove };
}
