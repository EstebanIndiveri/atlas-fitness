'use client';

import { useCallback, useMemo, useState } from 'react';

import { createTrainingPlan, TrainingPlanClientError } from '@/lib/api/training-plan';
import { PLAN_COPY, PLAN_WEEK_ORDER } from '@/lib/copy/plan';
import type { CreateTrainingPlanResult, TrainingPlanDayOfWeek } from '@/lib/services/training-plan';
import type { RoutineSummary } from '@/types/routine';

export interface PlanDayState {
  routineId: number | null;
  note: string;
}

type Assignments = Record<TrainingPlanDayOfWeek, PlanDayState>;

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

/**
 * Owns the weekly plan builder state: per-weekday routine assignment plus name and goal.
 *
 * @param _routines - The user's routines, used by the UI to render selectable options.
 * @returns Controlled fields, derived submit-readiness, and a submit action that posts the plan.
 * @example
 * const builder = usePlanBuilder(routines);
 * builder.setDayRoutine(1, routines[0].id);
 */
export function usePlanBuilder(_routines: readonly RoutineSummary[]): UsePlanBuilderResult {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [assignments, setAssignments] = useState<Assignments>(emptyAssignments);
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
      return await createTrainingPlan({
        name: trimmedName,
        ...(trimmedGoal.length > 0 ? { goal: trimmedGoal } : {}),
        schedule,
      });
    } catch (cause) {
      setError(
        cause instanceof TrainingPlanClientError ? cause.message : PLAN_COPY.genericError,
      );
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [goal, schedule, submitting, trimmedName]);

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
