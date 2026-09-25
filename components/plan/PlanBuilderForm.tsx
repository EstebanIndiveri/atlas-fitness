'use client';

import type { FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { fieldClassName } from '@/components/ui/Input';
import { PLAN_COPY, PLAN_DAY_LABELS, PLAN_TEST_IDS, PLAN_WEEK_ORDER } from '@/lib/copy/plan';
import type { PlanDayState } from '@/hooks/usePlanBuilder';
import type { TrainingPlanDayOfWeek } from '@/lib/services/training-plan';
import type { RoutineSummary } from '@/types/routine';

export interface PlanBuilderFormProps {
  mode?: 'create' | 'edit';
  routines: readonly RoutineSummary[];
  name: string;
  goal: string;
  assignments: Record<TrainingPlanDayOfWeek, PlanDayState>;
  selectedCount: number;
  canSubmit: boolean;
  submitting: boolean;
  error: string | null;
  onNameChange: (value: string) => void;
  onGoalChange: (value: string) => void;
  onDayRoutineChange: (day: TrainingPlanDayOfWeek, routineId: number | null) => void;
  onDayNoteChange: (day: TrainingPlanDayOfWeek, note: string) => void;
  onSubmit: () => void;
}

/**
 * Controlled weekly plan builder: a name, an optional goal, and a routine (or rest) per weekday.
 *
 * @param props - Controlled field values plus change/submit callbacks owned by usePlanBuilder.
 * @returns The plan builder form; note fields appear only for days with an assigned routine.
 */
export function PlanBuilderForm({
  mode = 'create',
  routines,
  name,
  goal,
  assignments,
  selectedCount,
  canSubmit,
  submitting,
  error,
  onNameChange,
  onGoalChange,
  onDayRoutineChange,
  onDayNoteChange,
  onSubmit,
}: PlanBuilderFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSubmit();
  }

  function handleDayChange(day: TrainingPlanDayOfWeek, value: string): void {
    onDayRoutineChange(day, value === '' ? null : Number(value));
  }

  return (
    <form data-testid={PLAN_TEST_IDS.form} onSubmit={handleSubmit} className="space-y-6" noValidate>
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-ink">
          {mode === 'edit' ? PLAN_COPY.editTitle : PLAN_COPY.title}
        </h1>
        <p className="text-sm text-ink-muted">
          {mode === 'edit' ? PLAN_COPY.editSubtitle : PLAN_COPY.subtitle}
        </p>
      </header>

      <div className="space-y-4">
        <div>
          <label htmlFor="plan-name" className="mb-1 block text-sm font-medium text-ink">
            {PLAN_COPY.nameLabel}
          </label>
          <input
            id="plan-name"
            data-testid={PLAN_TEST_IDS.name}
            className={fieldClassName(false)}
            value={name}
            maxLength={120}
            placeholder={PLAN_COPY.namePlaceholder}
            onChange={(event) => onNameChange(event.target.value)}
          />
        </div>

        <div>
          <label htmlFor="plan-goal" className="mb-1 block text-sm font-medium text-ink">
            {PLAN_COPY.goalLabel}
          </label>
          <input
            id="plan-goal"
            data-testid={PLAN_TEST_IDS.goal}
            className={fieldClassName(false)}
            value={goal}
            maxLength={60}
            placeholder={PLAN_COPY.goalPlaceholder}
            onChange={(event) => onGoalChange(event.target.value)}
          />
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-ink">{PLAN_COPY.daysTitle}</legend>
        <p className="text-xs text-ink-muted">{PLAN_COPY.daysHint}</p>

        <ul className="space-y-3">
          {PLAN_WEEK_ORDER.map((day) => {
            const dayLabel = PLAN_DAY_LABELS[day];
            const assignment = assignments[day];
            const hasRoutine = assignment.routineId !== null;
            const selectId = `plan-day-${day}`;

            return (
              <li key={day} className="rounded-lg border border-line bg-surface p-3">
                <label htmlFor={selectId} className="mb-1 block text-sm font-medium text-ink">
                  {dayLabel}
                </label>
                <select
                  id={selectId}
                  data-testid={PLAN_TEST_IDS.daySelect(day)}
                  aria-label={PLAN_COPY.routineSelectLabel(dayLabel)}
                  className={fieldClassName(false)}
                  value={assignment.routineId === null ? '' : String(assignment.routineId)}
                  onChange={(event) => handleDayChange(day, event.target.value)}
                >
                  <option value="">{PLAN_COPY.restOption}</option>
                  {routines.map((routine) => (
                    <option key={routine.id} value={String(routine.id)}>
                      {routine.name}
                    </option>
                  ))}
                </select>

                {hasRoutine ? (
                  <div className="mt-2">
                    <label
                      htmlFor={`${selectId}-note`}
                      className="mb-1 block text-xs font-medium text-ink-muted"
                    >
                      {PLAN_COPY.noteLabel}
                    </label>
                    <input
                      id={`${selectId}-note`}
                      data-testid={PLAN_TEST_IDS.dayNote(day)}
                      className={fieldClassName(false)}
                      value={assignment.note}
                      maxLength={140}
                      placeholder={PLAN_COPY.notePlaceholder}
                      onChange={(event) => onDayNoteChange(day, event.target.value)}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </fieldset>

      <p data-testid={PLAN_TEST_IDS.summary} className="text-sm font-medium text-ink">
        {PLAN_COPY.summary(selectedCount)}
      </p>

      {error ? (
        <p data-testid={PLAN_TEST_IDS.error} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        data-testid={PLAN_TEST_IDS.submit}
        disabled={!canSubmit || submitting}
      >
        {submitting ? PLAN_COPY.submitting : mode === 'edit' ? 'Guardar cambios' : PLAN_COPY.submit}
      </Button>
    </form>
  );
}
