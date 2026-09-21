import Link from 'next/link';
import { Button, buttonClassName } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ROUTINE_COPY, ROUTINE_TEST_IDS } from '@/lib/copy/routines';
import type { RoutineSummary } from '@/types/routine';

type RoutineSummaryCardProps = {
  routine: RoutineSummary;
  starting: boolean;
  error: string | null;
  onStart: () => void;
};

function formatKind(routine: RoutineSummary): string {
  return routine.kind === 'home' ? ROUTINE_COPY.detailEyebrowHome : ROUTINE_COPY.detailEyebrowGym;
}

function formatCount(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function totalSets(routine: RoutineSummary): number {
  return routine.exercises.reduce((sum, exercise) => sum + exercise.targetSets, 0);
}

function uniqueMuscleGroups(routine: RoutineSummary): string[] {
  return Array.from(
    new Set(
      routine.exercises
        .map((exercise) => exercise.muscleGroup.trim())
        .filter((muscleGroup) => muscleGroup.length > 0),
    ),
  );
}

/**
 * Shows honest routine metadata and primary actions for the read-only detail screen.
 *
 * @param props - Routine data, start state, and start action handler.
 * @returns The summary card with counts, muscle emphasis, and CTAs.
 */
export function RoutineSummaryCard({ routine, starting, error, onStart }: RoutineSummaryCardProps) {
  const sets = totalSets(routine);
  const muscles = uniqueMuscleGroups(routine);
  const muscleText = `${ROUTINE_COPY.muscleEmphasis}: ${muscles.join(', ')}`;
  const countChip = `${formatCount(routine.exercises.length, 'ejercicio', 'ejercicios')} · ${formatCount(
    sets,
    'serie',
    'series',
  )}`;

  return (
    <Card className="rounded-2xl border border-line p-4 shadow-card" data-testid={ROUTINE_TEST_IDS.detailSummary}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="rounded-full bg-brand-muted px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand">
          {formatKind(routine)}
        </p>
        {routine.isSystem ? <p className="text-xs font-medium text-ink-muted">{ROUTINE_COPY.systemBadge}</p> : null}
      </div>

      <h1 className="mt-3 text-3xl font-semibold leading-tight text-ink">{routine.name}</h1>
      {routine.description ? <p className="mt-2 text-sm leading-6 text-ink-muted">{routine.description}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-md bg-canvas px-3 py-1 text-xs font-medium text-ink">{countChip}</span>
      </div>

      {muscles.length > 0 ? (
        <p className="mt-5 border-t border-line pt-4 text-sm font-semibold leading-6 text-ink">{muscleText}</p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 rounded-md bg-danger-muted p-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-5 space-y-3">
        <Button
          size="lg"
          className="rounded-2xl"
          disabled={starting}
          data-testid={ROUTINE_TEST_IDS.detailStart}
          onClick={onStart}
        >
          {starting ? ROUTINE_COPY.startWorkoutBusy : ROUTINE_COPY.startWorkout}
        </Button>
        <Link
          href={`/dashboard/routines/${routine.id}/edit`}
          className={buttonClassName({ variant: 'secondary', size: 'lg', className: 'rounded-2xl' })}
        >
          {ROUTINE_COPY.editRoutine}
        </Link>
      </div>
    </Card>
  );
}
