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
    <section aria-labelledby="routine-exercise-sequence" className="space-y-3 pb-3">
      <div className="flex items-end justify-between gap-4 px-1">
        <h2 id="routine-exercise-sequence" className="font-serif text-3xl font-semibold leading-none text-ink">
          {ROUTINE_COPY.exerciseSequenceTitle}
        </h2>
        <p className="max-w-36 text-right text-xs leading-4 text-ink-muted">Podés consultar técnica pulsando</p>
      </div>

      <Card className="divide-y divide-line overflow-hidden rounded-[1.35rem] border border-line p-0 shadow-card">
        {exercises.length === 0 ? (
          <p className="p-4 text-sm text-ink-muted">{ROUTINE_COPY.exerciseSequenceEmpty}</p>
        ) : null}
        {exercises.map((exercise, index) => {
          const hasTechnique = exercise.instructions.trim().length > 0;
          return (
            <article
              key={exercise.id}
              className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] gap-3 p-4"
              data-testid={ROUTINE_TEST_IDS.detailExercise}
            >
              <div
                aria-hidden="true"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-canvas text-sm font-bold text-ink"
              >
                {index + 1}
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h3 className="min-w-0 truncate font-semibold text-ink">{exercise.exerciseName}</h3>
                </div>
                <p className="mt-1 line-clamp-1 text-sm text-ink-muted">{exercise.muscleGroup}</p>
                <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 text-xs">
                  <span className="max-w-full rounded-full bg-canvas px-3 py-2 font-semibold text-brand">
                    {`${exercise.targetSets} series × ${exercise.targetReps} reps`}
                  </span>
                  <span className="max-w-full rounded-full bg-canvas px-3 py-2 font-semibold text-ink-muted">
                    ⏱ {formatRest(routine.restSeconds)}
                  </span>
                </div>
                {hasTechnique ? (
                  <details className="mt-3 text-sm text-ink-muted">
                    <summary className="cursor-pointer font-medium text-ink">Ver técnica</summary>
                    <p className="mt-2 leading-6">{exercise.instructions}</p>
                  </details>
                ) : null}
              </div>
              <span className="pt-1 text-2xl leading-none text-ink-muted" aria-hidden="true">
                ▸
              </span>
            </article>
          );
        })}
      </Card>
    </section>
  );
}
