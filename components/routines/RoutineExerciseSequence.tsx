import { Card } from '@/components/ui/Card';
import { ROUTINE_COPY, ROUTINE_TEST_IDS } from '@/lib/copy/routines';
import type { RoutineSummary } from '@/types/routine';

type RoutineExerciseSequenceProps = {
  routine: RoutineSummary;
};

function formatRest(seconds: number): string {
  if (seconds > 0 && seconds % 60 === 0) {
    return `${seconds / 60} min descanso`;
  }
  return `${seconds} s descanso`;
}

function sortedExercises(routine: RoutineSummary): RoutineSummary['exercises'] {
  return [...routine.exercises].sort((left, right) => left.sortOrder - right.sortOrder);
}

/**
 * Renders the ordered exercise list with real prescription data from the routine API.
 *
 * @param props - The routine containing ordered exercises and rest prescription.
 * @returns The read-only exercise sequence section.
 */
export function RoutineExerciseSequence({ routine }: RoutineExerciseSequenceProps) {
  const exercises = sortedExercises(routine);

  return (
    <section aria-labelledby="routine-exercise-sequence" className="space-y-3">
      <div className="flex items-end justify-between gap-4 px-1">
        <div>
          <h2 id="routine-exercise-sequence" className="text-2xl font-semibold leading-none text-ink">
            {ROUTINE_COPY.exerciseSequenceTitle}
          </h2>
        </div>
        <p className="max-w-36 text-xs leading-4 text-ink-muted">{ROUTINE_COPY.exerciseSequenceHelp}</p>
      </div>

      <Card className="divide-y divide-line overflow-hidden rounded-2xl border border-line p-0 shadow-card">
        {exercises.length === 0 ? (
          <p className="p-4 text-sm text-ink-muted">{ROUTINE_COPY.exerciseSequenceEmpty}</p>
        ) : null}
        {exercises.map((exercise, index) => (
          <article
            key={exercise.id}
            className="grid grid-cols-[2rem_1fr] gap-3 p-4"
            data-testid={ROUTINE_TEST_IDS.detailExercise}
          >
            <div
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-muted text-sm font-bold text-brand"
            >
              {index + 1}
            </div>
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-ink">{exercise.exerciseName}</h3>
                  <p className="mt-1 text-sm text-ink-muted">{exercise.muscleGroup}</p>
                </div>
                {exercise.instructions.trim().length > 0 ? (
                  <span className="text-xl leading-none text-ink-muted" aria-hidden="true">
                    ›
                  </span>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="rounded-md bg-canvas px-3 py-2 font-semibold text-brand">
                  {`${exercise.targetSets} series × ${exercise.targetReps} reps`}
                </span>
                <span className="text-ink-muted">{formatRest(routine.restSeconds)}</span>
              </div>
              {exercise.instructions.trim().length > 0 ? (
                <details className="mt-3 text-sm text-ink-muted">
                  <summary className="cursor-pointer font-medium text-ink">Ver técnica</summary>
                  <p className="mt-2 leading-6">{exercise.instructions}</p>
                </details>
              ) : null}
            </div>
          </article>
        ))}
      </Card>
    </section>
  );
}
