'use client';

import Link from 'next/link';

import { Button, buttonClassName } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/states';
import { UI_COPY } from '@/lib/copy/ui';
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
        <div className="flex items-baseline gap-2">
          <h2
            id="my-routines-title"
            className="font-serif text-xl font-semibold tracking-[-0.03em] text-ink"
          >
            {UI_COPY.training.myRoutinesTitle}
          </h2>
          <span className="text-xs text-ink-muted">{formatRoutineTotal(routines.length)}</span>
        </div>
        <Link href="/dashboard/routines" className="text-sm font-medium text-brand hover:underline">
          Ordenar
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
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-line">
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
        </Card>
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
    <div className="flex items-center gap-3 bg-surface px-4 py-3" data-testid="routine-card">
      <span
        className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-muted text-brand"
        aria-hidden="true"
      >
        🏋
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-bold text-ink">{routine.name}</h3>
        <p className="mt-1 text-xs text-ink-muted">
          {formatCount(exerciseCount, UI_COPY.training.exerciseSingular, UI_COPY.training.exercisePlural)}
          {' · '}
          {formatCount(setCount, UI_COPY.training.setSingular, UI_COPY.training.setPlural)}
        </p>
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => onStart(routine.id)}
        disabled={disabled}
        data-testid="start-routine"
        className="shrink-0 rounded-lg bg-brand-muted text-brand ring-0"
      >
        {starting ? UI_COPY.training.startingWorkout : `▶ ${UI_COPY.training.routineStart}`}
      </Button>
    </div>
  );
}

function formatRoutineTotal(value: number): string {
  return `${value} ${value === 1 ? 'rutina' : 'rutinas'}`;
}

function formatCount(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}
