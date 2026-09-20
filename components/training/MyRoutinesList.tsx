'use client';

import Link from 'next/link';

import { Button, buttonClassName } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { MetricValue } from '@/components/ui/MetricValue';
import { EmptyState } from '@/components/ui/states';
import { UI_COPY } from '@/lib/copy/ui';
import { metric } from '@/types/metric';
import type { Workout } from '@/lib/db/schema';
import type { RoutineSummary } from '@/types/routine';

type ActiveWorkout = Pick<Workout, 'id' | 'routineId'>;

type MyRoutinesListProps = {
  routines: RoutineSummary[];
  activeWorkout: ActiveWorkout | null;
  starting: number | null;
  onStart: (routineId: number) => void;
};

/**
 * Lists routines with data-honest exercise and set counts.
 *
 * @param props Routines, active workout state, and start handler.
 * @returns Routine list or an empty state.
 * @throws Does not throw.
 * @example
 * <MyRoutinesList routines={routines} activeWorkout={null} starting={null} onStart={start} />
 */
export function MyRoutinesList({
  routines,
  activeWorkout,
  starting,
  onStart,
}: MyRoutinesListProps) {
  const activeHref =
    activeWorkout === null
      ? null
      : activeWorkout.routineId
        ? `/dashboard/session/${activeWorkout.id}`
        : `/dashboard/workout/${activeWorkout.id}`;

  return (
    <section aria-labelledby="my-routines-title" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="my-routines-title" className="text-xl font-bold text-ink">
          {UI_COPY.training.myRoutinesTitle}
        </h2>
        <Link
          href="/dashboard/routines"
          className="text-sm font-medium text-brand hover:underline"
        >
          {UI_COPY.training.managePlan}
        </Link>
      </div>

      {activeHref ? (
        <Card tone="warning" className="space-y-3 p-4">
          <p className="text-sm text-ink">{UI_COPY.training.activeExists}</p>
          <Link
            href={activeHref}
            className={buttonClassName({ variant: 'success' })}
            data-testid="continue-active-session"
          >
            {activeWorkout?.routineId
              ? UI_COPY.training.continueGuided
              : UI_COPY.training.continueWorkout}
          </Link>
        </Card>
      ) : null}

      {routines.length === 0 ? (
        <Card>
          <EmptyState
            title={UI_COPY.training.emptyRoutinesTitle}
            description={UI_COPY.training.emptyRoutinesBody}
            action={
              <Link href="/dashboard/routines/new" className={buttonClassName()}>
                {UI_COPY.training.createRoutine}
              </Link>
            }
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {routines.map((routine) => (
            <li key={routine.id}>
              <RoutineCard
                routine={routine}
                disabled={activeWorkout !== null || starting !== null}
                starting={starting === routine.id}
                onStart={onStart}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RoutineCard({
  routine,
  disabled,
  starting,
  onStart,
}: {
  routine: RoutineSummary;
  disabled: boolean;
  starting: boolean;
  onStart: (routineId: number) => void;
}) {
  const exerciseCount = routine.exercises.length;
  const setCount = routine.exercises.reduce((total, exercise) => total + exercise.targetSets, 0);

  return (
    <Card className="space-y-4 p-4" data-testid="routine-card">
      <div>
        <h3 className="text-lg font-semibold text-ink">{routine.name}</h3>
        {routine.description ? (
          <p className="mt-1 text-sm leading-6 text-ink-muted">{routine.description}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        <MetricValue
          metric={metric(formatCount(exerciseCount, UI_COPY.training.exerciseSingular, UI_COPY.training.exercisePlural), 'atlas_computed')}
          label={UI_COPY.training.routineExerciseCountLabel}
        />
        <MetricValue
          metric={metric(formatCount(setCount, UI_COPY.training.setSingular, UI_COPY.training.setPlural), 'atlas_computed')}
          label={UI_COPY.training.routineSetCountLabel}
        />
      </div>
      <Button
        onClick={() => onStart(routine.id)}
        disabled={disabled}
        data-testid="start-routine"
      >
        {starting ? UI_COPY.training.startingWorkout : UI_COPY.training.routineStart}
      </Button>
    </Card>
  );
}

function formatCount(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}
