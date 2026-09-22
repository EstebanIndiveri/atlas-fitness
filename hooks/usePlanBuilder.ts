'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  createTrainingPlan,
  getTrainingPlan,
  TrainingPlanClientError,
  updateTrainingPlan,
} from '@/lib/api/training-plan';
import { PLAN_COPY, PLAN_WEEK_ORDER } from '@/lib/copy/plan';
import type { CreateTrainingPlanResult, TrainingPlanDayOfWeek } from '@/lib/services/training-plan';
import type { RoutineSummary } from '@/types/routine';

export interface PlanDayState {
  routineId: number | null;
  note: string;
}

type Assignments = Record<TrainingPlanDayOfWeek, PlanDayState>;

export interface UsePlanBuilderOptions {
  mode?: 'create' | 'edit';
  initialPlan?: CreateTrainingPlanResult | null;
}

export interface UseEditableTrainingPlanResult {
  plan: CreateTrainingPlanResult | null;
  loading: boolean;
  error: string | null;
  notFound: boolean;
}

export interface UsePlanBuilderResult {
  name: string;
  setName: (value: string) => void;
  goal: string;
  setGoal: (value: string) => void;
  assignments: Assignments;
  setDayRoutine: (day: TrainingPlanDayOfWeek, routineId: number | null) => void;
  setDayNote: (day: TrainingPlanDayOfWeek, note: string) => void;
  selectedCount: number;
  canSubmit: boolean;
  submitting: boolean;
  error: string | null;
  submit: () => Promise<CreateTrainingPlanResult | null>;
}

function emptyAssignments(): Assignments {
  return PLAN_WEEK_ORDER.reduce((acc, day) => {
    acc[day] = { routineId: null, note: '' };
    return acc;
  }, {} as Assignments);
}

function assignmentsFromPlan(plan: CreateTrainingPlanResult | null | undefined): Assignments {
  const assignments = emptyAssignments();
  if (!plan) {
    return assignments;
  }

  for (const item of plan.schedule) {
    if (isTrainingPlanDayOfWeek(item.dayOfWeek)) {
      assignments[item.dayOfWeek] = { routineId: item.routineId, note: item.note ?? '' };
    }
  }
  return assignments;
}

function isTrainingPlanDayOfWeek(value: number): value is TrainingPlanDayOfWeek {
  return PLAN_WEEK_ORDER.includes(value as TrainingPlanDayOfWeek);
}

/**
 * Owns the weekly plan builder state: per-weekday routine assignment plus name and goal.
 *
 * @param _routines - The user's routines, used by the UI to render selectable options.
 * @param options - Optional edit-mode plan used to prefill fields and PATCH instead of POST.
 * @returns Controlled fields, derived submit-readiness, and a submit action that writes the plan.
 * @example
 * const builder = usePlanBuilder(routines);
 * builder.setDayRoutine(1, routines[0].id);
 */
export function usePlanBuilder(
  _routines: readonly RoutineSummary[],
  options: UsePlanBuilderOptions = {},
): UsePlanBuilderResult {
  const mode = options.mode ?? 'create';
  const initialPlan = options.initialPlan ?? null;
  const [name, setName] = useState(initialPlan?.plan.name ?? '');
  const [goal, setGoal] = useState(initialPlan?.plan.goal ?? '');
  const [assignments, setAssignments] = useState<Assignments>(() => assignmentsFromPlan(initialPlan));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setDayRoutine = useCallback((day: TrainingPlanDayOfWeek, routineId: number | null) => {
    setAssignments((current) => ({ ...current, [day]: { ...current[day], routineId } }));
  }, []);

  const setDayNote = useCallback((day: TrainingPlanDayOfWeek, note: string) => {
    setAssignments((current) => ({ ...current, [day]: { ...current[day], note } }));
  }, []);

  const schedule = useMemo(
    () =>
      PLAN_WEEK_ORDER.filter((day) => assignments[day].routineId !== null).map((day) => {
        const note = assignments[day].note.trim();
        return {
          dayOfWeek: day,
          routineId: assignments[day].routineId as number,
          note: note.length > 0 ? note : undefined,
        };
      }),
    [assignments],
  );

  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0 && schedule.length > 0 && !submitting;

  const submit = useCallback(async (): Promise<CreateTrainingPlanResult | null> => {
    if (trimmedName.length === 0 || schedule.length === 0 || submitting) {
      return null;
    }
    setSubmitting(true);
    setError(null);
    try {
      const trimmedGoal = goal.trim();
      const payload = {
        name: trimmedName,
        ...(trimmedGoal.length > 0 ? { goal: trimmedGoal } : {}),
        schedule,
      };
      return mode === 'edit' && initialPlan
        ? await updateTrainingPlan(initialPlan.plan.id, payload)
        : await createTrainingPlan(payload);
    } catch (cause) {
      setError(
        cause instanceof TrainingPlanClientError ? cause.message : PLAN_COPY.genericError,
      );
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [goal, initialPlan, mode, schedule, submitting, trimmedName]);

  return {
    name,
    setName,
    goal,
    setGoal,
    assignments,
    setDayRoutine,
    setDayNote,
    selectedCount: schedule.length,
    canSubmit,
    submitting,
    error,
    submit,
  };
}

/**
 * Loads an editable weekly training plan for the plan edit page.
 *
 * @param planId - Parsed training plan id, or undefined when the route param is invalid.
 * @returns Loading, error, not-found, and plan state for edit-mode rendering.
 * @example
 * const state = useEditableTrainingPlan(10);
 */
export function useEditableTrainingPlan(planId: number | undefined): UseEditableTrainingPlanResult {
  const [plan, setPlan] = useState<CreateTrainingPlanResult | null>(null);
  const [loading, setLoading] = useState(planId !== undefined);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(planId === undefined);

  useEffect(() => {
    if (planId === undefined) {
      return;
    }

    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const loaded = await getTrainingPlan(planId as number);
        if (cancelled) return;
        setPlan(loaded);
        setError(null);
      } catch (cause) {
        if (cancelled) return;
        const mapped =
          cause instanceof TrainingPlanClientError
            ? cause
            : new TrainingPlanClientError('generic', PLAN_COPY.genericError, 0);
        setPlan(null);
        setNotFound(mapped.kind === 'not_found');
        setError(mapped.kind === 'not_found' ? null : mapped.message);
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
  }, [planId]);

  return { plan, loading, error, notFound };
}
