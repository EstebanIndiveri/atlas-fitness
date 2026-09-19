'use client';

import Link from 'next/link';
import { Button, buttonClassName } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ROUTINE_COPY, ROUTINE_TEST_IDS } from '@/lib/copy/routines';
import { SESSION_COPY } from '@/lib/copy/session';
import type { RoutineSummary } from '@/types/routine';

type RoutinePickerProps = {
  routines: RoutineSummary[];
  startingId: number | null;
  onStart: (routineId: number) => void;
  activeWorkoutId: number | null;
  activeIsGuided: boolean;
};

export function RoutinePicker({
  routines,
  startingId,
  onStart,
  activeWorkoutId,
  activeIsGuided,
}: RoutinePickerProps) {
  if (routines.length === 0) {
    return (
      <Card>
        <h2 className="text-lg font-semibold text-ink">{SESSION_COPY.emptyRoutinesTitle}</h2>
        <p className="mt-2 text-sm text-ink-muted">{SESSION_COPY.emptyRoutinesBody}</p>
        <Link
          href="/dashboard/routines"
          className={buttonClassName({ variant: 'secondary', className: 'mt-3' })}
          data-testid={ROUTINE_TEST_IDS.manageCta}
        >
          {ROUTINE_COPY.manageCta}
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        href="/dashboard/routines"
        className={buttonClassName({ variant: 'secondary' })}
        data-testid={ROUTINE_TEST_IDS.manageCta}
      >
        {ROUTINE_COPY.manageCta}
      </Link>
      {activeWorkoutId ? (
        <Card tone="warning" className="p-4">
          <p className="text-sm text-ink">{SESSION_COPY.activeExists}</p>
          <Link
            href={
              activeIsGuided
                ? `/dashboard/session/${activeWorkoutId}`
                : `/dashboard/workout/${activeWorkoutId}`
            }
            className={buttonClassName({ variant: 'success', className: 'mt-3' })}
            data-testid="continue-active-session"
          >
            {activeIsGuided ? SESSION_COPY.continueGuided : 'Continuar Entrenamiento'}
          </Link>
        </Card>
      ) : null}

      {routines.map((routine) => (
        <Card key={routine.id} className="p-4" data-testid="routine-card">
          <h2 className="text-lg font-semibold text-ink">{routine.name}</h2>
          {routine.description ? (
            <p className="mt-1 text-sm text-ink-muted">{routine.description}</p>
          ) : null}
          <p className="mt-2 text-xs text-ink-muted">
            {routine.exercises.map((item) => item.exerciseName).join(' · ')}
          </p>
          <Button
            className="mt-3"
            onClick={() => onStart(routine.id)}
            disabled={startingId !== null || activeWorkoutId !== null}
            data-testid="start-routine"
          >
            {SESSION_COPY.startRoutine}
          </Button>
        </Card>
      ))}
    </div>
  );
}
