'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  HabitTargetClientError,
  deactivateHabitTarget,
  fetchHabitTargets,
  saveHabitTarget,
  type HabitTargetResponse,
} from '@/lib/api/habit-targets';
import { HABIT_TARGET_COPY } from '@/lib/copy/habit-targets';
import { resolveExpectedHabitDays } from '@/lib/services/habit-target-adherence';
import { cordobaLocalDate } from '@/lib/time/cordoba';
import { HABIT_KEYS, type HabitKey } from '@/types/habit';
import type { HabitTargetScheduleVersion, HabitTargetWeekday } from '@/types/habit-target';

/** One active target per catalog habit; `null` when the habit is not configured. */
export type HabitTargetsByKey = Record<HabitKey, HabitTargetResponse | null>;

export type HabitTargetErrorKind =
  | 'unauthorized'
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'generic';

export interface HabitTargetsError {
  kind: HabitTargetErrorKind;
  message: string;
}

export interface UseHabitTargetsResult {
  /** Current active target per catalog habit, in the closed catalog. */
  targets: HabitTargetsByKey;
  /** Whether today (Córdoba) is an objective for each habit, from the canonical domain. */
  expectedTodayByKey: Record<HabitKey, boolean>;
  /** Number of catalog habits with an active target today (configuration axis). */
  configuredCount: number;
  loading: boolean;
  saving: boolean;
  error: HabitTargetsError | null;
  /** Bumped after every successful mutation so read-back windows can refetch. */
  revision: number;
  reload: () => void;
  save: (habitKey: HabitKey, weekdays: readonly HabitTargetWeekday[]) => Promise<boolean>;
  deactivate: (habitKey: HabitKey) => Promise<boolean>;
}

function emptyTargets(): HabitTargetsByKey {
  return Object.fromEntries(HABIT_KEYS.map((key) => [key, null])) as HabitTargetsByKey;
}

function emptyExpectedByKey(): Record<HabitKey, boolean> {
  return Object.fromEntries(HABIT_KEYS.map((key) => [key, false])) as Record<HabitKey, boolean>;
}

function indexByKey(list: readonly HabitTargetResponse[]): HabitTargetsByKey {
  const targets = emptyTargets();
  for (const target of list) {
    targets[target.habitKey] = target;
  }
  return targets;
}

/**
 * Resolves which habits are expected today via the canonical pure domain, never
 * a re-implementation of the schedule rule in the UI.
 *
 * `resolveExpectedHabitDays` validates the versions and matches the Córdoba
 * Sunday-first weekday, so the marker agrees with the adherence window. A guard
 * keeps an unexpected validation failure from claiming any objective.
 */
function resolveExpectedTodayByKey(targets: HabitTargetsByKey): Record<HabitKey, boolean> {
  const expected = emptyExpectedByKey();
  const schedules: HabitTargetScheduleVersion[] = [];

  for (const habitKey of HABIT_KEYS) {
    const target = targets[habitKey];
    if (target !== null) {
      schedules.push({
        habitKey,
        effectiveFrom: target.effectiveFrom,
        effectiveTo: target.effectiveTo,
        version: target.version,
        weekdays: target.weekdays,
      });
    }
  }

  if (schedules.length === 0) {
    return expected;
  }

  try {
    const today = cordobaLocalDate();
    for (const habitDay of resolveExpectedHabitDays({ schedules, start: today, end: today })) {
      expected[habitDay.habitKey] = true;
    }
  } catch {
    return emptyExpectedByKey();
  }

  return expected;
}

function mapLoadError(caught: unknown): HabitTargetsError {
  if (caught instanceof HabitTargetClientError && caught.kind === 'unauthorized') {
    return { kind: 'unauthorized', message: HABIT_TARGET_COPY.sessionExpired };
  }
  return { kind: 'generic', message: HABIT_TARGET_COPY.loadError };
}

function mapWriteError(caught: unknown, fallback: string): HabitTargetsError {
  if (caught instanceof HabitTargetClientError) {
    if (caught.kind === 'conflict') {
      return { kind: 'conflict', message: HABIT_TARGET_COPY.conflict };
    }
    if (caught.kind === 'unauthorized') {
      return { kind: 'unauthorized', message: HABIT_TARGET_COPY.sessionExpired };
    }
    if (caught.kind === 'validation' || caught.kind === 'not_found') {
      return { kind: caught.kind, message: caught.message };
    }
  }
  return { kind: 'generic', message: fallback };
}

/**
 * Loads the authenticated user's versioned weekly habit targets and mutates them
 * with explicit compare-and-swap tokens.
 *
 * Targets are `source: user_input` intention, never inferred. On a `409` the hook
 * reloads the server truth so the UI can never keep editing a stale version, and
 * a failed load preserves the already-loaded targets rather than showing empty
 * defaults as real data. Every successful mutation bumps {@link revision} so the
 * adherence read-back refetches without optimistically rewriting history.
 *
 * @returns Current targets, today markers, loading/saving/error state and mutators.
 * @example
 * const { targets, save } = useHabitTargets();
 * await save('walk', [1, 3]);
 */
export function useHabitTargets(): UseHabitTargetsResult {
  const [targets, setTargets] = useState<HabitTargetsByKey>(emptyTargets);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<HabitTargetsError | null>(null);
  const [requestId, setRequestId] = useState(0);
  const [revision, setRevision] = useState(0);

  const mountedRef = useRef(true);
  const targetsRef = useRef<HabitTargetsByKey>(targets);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    targetsRef.current = targets;
  }, [targets]);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const list = await fetchHabitTargets();
        if (!cancelled) {
          setTargets(indexByKey(list));
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(mapLoadError(caught));
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

  const refresh = useCallback(() => {
    setRequestId((current) => current + 1);
  }, []);

  const refreshServerTruth = useCallback(async () => {
    try {
      const list = await fetchHabitTargets();
      if (mountedRef.current) {
        setTargets(indexByKey(list));
      }
    } catch {
      // Keep whatever the user can still see; the conflict notice already owns the screen.
    }
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (habitKey: HabitKey, weekdays: readonly HabitTargetWeekday[]): Promise<boolean> => {
      const current = targetsRef.current[habitKey];
      setSaving(true);
      setError(null);

      try {
        await saveHabitTarget(
          habitKey,
          weekdays,
          current === null
            ? { expectedTargetId: null, expectedVersion: null }
            : { expectedTargetId: current.id, expectedVersion: current.version },
        );
        if (mountedRef.current) {
          setRevision((value) => value + 1);
          refresh();
        }
        return true;
      } catch (caught) {
        if (mountedRef.current) {
          const mapped = mapWriteError(caught, HABIT_TARGET_COPY.saveError);
          setError(mapped);
          if (mapped.kind === 'conflict') {
            void refreshServerTruth();
          }
        }
        return false;
      } finally {
        if (mountedRef.current) {
          setSaving(false);
        }
      }
    },
    [refresh, refreshServerTruth],
  );

  const deactivate = useCallback(
    async (habitKey: HabitKey): Promise<boolean> => {
      const current = targetsRef.current[habitKey];
      if (current === null) {
        return true;
      }

      setSaving(true);
      setError(null);

      try {
        await deactivateHabitTarget(habitKey, {
          expectedTargetId: current.id,
          expectedVersion: current.version,
        });
        if (mountedRef.current) {
          setRevision((value) => value + 1);
          refresh();
        }
        return true;
      } catch (caught) {
        if (mountedRef.current) {
          const mapped = mapWriteError(caught, HABIT_TARGET_COPY.deactivateError);
          setError(mapped);
          if (mapped.kind === 'conflict') {
            void refreshServerTruth();
          }
        }
        return false;
      } finally {
        if (mountedRef.current) {
          setSaving(false);
        }
      }
    },
    [refresh, refreshServerTruth],
  );

  const expectedTodayByKey = useMemo(() => resolveExpectedTodayByKey(targets), [targets]);
  const configuredCount = useMemo(
    () => HABIT_KEYS.filter((habitKey) => targets[habitKey] !== null).length,
    [targets],
  );

  return {
    targets,
    expectedTodayByKey,
    configuredCount,
    loading,
    saving,
    error,
    revision,
    reload,
    save,
    deactivate,
  };
}
