'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  HabitLogClientError,
  fetchTodayHabitLogs,
  setHabitLog,
  type HabitLogResponse,
} from '@/lib/api/habits';
import { TODAY_COPY } from '@/lib/copy/today';
import { HABIT_KEYS, isHabitKey, type HabitKey } from '@/types/habit';

export type HabitDoneMap = Record<HabitKey, boolean>;

type UseHabitsResult = {
  doneByKey: HabitDoneMap;
  loading: boolean;
  saving: boolean;
  error: string | null;
  reload: () => void;
  toggle: (habitKey: HabitKey) => Promise<void>;
};

function emptyDoneMap(): HabitDoneMap {
  return Object.fromEntries(HABIT_KEYS.map((key) => [key, false])) as HabitDoneMap;
}

function toDoneMap(logs: readonly HabitLogResponse[]): HabitDoneMap {
  const map = emptyDoneMap();
  for (const log of logs) {
    if (isHabitKey(log.habitKey)) {
      map[log.habitKey] = log.done;
    }
  }
  return map;
}

function mapLoadError(error: unknown): string {
  if (error instanceof HabitLogClientError && error.kind === 'unauthorized') {
    return TODAY_COPY.habitsSessionExpired;
  }
  return TODAY_COPY.habitsError;
}

function mapSaveError(error: unknown): string {
  if (error instanceof HabitLogClientError) {
    if (error.kind === 'validation') {
      return error.message;
    }
    if (error.kind === 'unauthorized') {
      return TODAY_COPY.habitsSessionExpired;
    }
  }
  return TODAY_COPY.habitsSaveError;
}

/**
 * Loads and toggles the authenticated user's manual daily habits.
 *
 * Every value is `source: user_input`; the hook exposes a complete done map for
 * the honest catalog and never derives fabricated counts (DATA HONESTY RULE).
 * Toggling is optimistic and rolls back if persistence fails.
 * @returns Done map plus loading/saving/error state, reload, and toggle helpers.
 * @example
 * const { doneByKey, toggle } = useHabits();
 * await toggle('hydration');
 */
export function useHabits(): UseHabitsResult {
  const [doneByKey, setDoneByKey] = useState<HabitDoneMap>(emptyDoneMap);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(0);
  const mountedRef = useRef(false);
  const doneByKeyRef = useRef<HabitDoneMap>(doneByKey);

  useEffect(() => {
    doneByKeyRef.current = doneByKey;
  }, [doneByKey]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const logs = await fetchTodayHabitLogs();
        if (!cancelled) {
          setDoneByKey(toDoneMap(logs));
          setError(null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setDoneByKey(emptyDoneMap());
          setError(mapLoadError(err));
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

  const toggle = useCallback(
    async (habitKey: HabitKey): Promise<void> => {
      const previous = doneByKeyRef.current[habitKey];
      const next = !previous;
      doneByKeyRef.current = { ...doneByKeyRef.current, [habitKey]: next };
      setDoneByKey((current) => ({ ...current, [habitKey]: next }));

      if (mountedRef.current) {
        setSaving(true);
        setError(null);
      }

      try {
        const saved = await setHabitLog({ habitKey, done: next });
        if (mountedRef.current) {
          setDoneByKey((current) => ({ ...current, [habitKey]: saved.done }));
        }
      } catch (err: unknown) {
        if (mountedRef.current) {
          doneByKeyRef.current = { ...doneByKeyRef.current, [habitKey]: previous };
          setDoneByKey((current) => ({ ...current, [habitKey]: previous }));
          setError(mapSaveError(err));
        }
      } finally {
        if (mountedRef.current) {
          setSaving(false);
        }
      }
    },
    [],
  );

  return { doneByKey, loading, saving, error, reload, toggle };
}
