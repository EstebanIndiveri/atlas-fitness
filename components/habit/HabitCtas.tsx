'use client';

import Link from 'next/link';
import { Button, buttonClassName } from '@/components/ui/Button';
import { SESSION_COPY } from '@/lib/copy/session';
import { UI_COPY } from '@/lib/copy/ui';
import type { Workout } from '@/lib/db/schema';

type HabitCtasProps = {
  activeWorkout: Workout | null;
  onStartWorkout?: () => void;
  disabled?: boolean;
};

export function HabitCtas({ activeWorkout, onStartWorkout, disabled = false }: HabitCtasProps) {
  if (activeWorkout) {
    return (
      <Link
        href={
          activeWorkout.routineId
            ? `/dashboard/session/${activeWorkout.id}`
            : `/dashboard/workout/${activeWorkout.id}`
        }
        className={buttonClassName({ variant: 'success', className: 'min-h-11 flex-1 text-center' })}
        data-testid="continue-workout-cta"
      >
        {activeWorkout.routineId ? SESSION_COPY.continueGuided : UI_COPY.continueWorkout}
      </Link>
    );
  }

  return (
    <>
      <Button
        onClick={onStartWorkout}
        className="min-h-11 flex-1"
        disabled={disabled || !onStartWorkout}
        data-testid="new-workout-button"
      >
        {UI_COPY.startWorkout}
      </Button>
      <Link
        href="/dashboard/session"
        className={buttonClassName({
          variant: 'secondary',
          className: 'min-h-11 flex-1 text-center',
        })}
        data-testid="guided-session-cta"
      >
        {SESSION_COPY.guidedCta}
      </Link>
    </>
  );
}
