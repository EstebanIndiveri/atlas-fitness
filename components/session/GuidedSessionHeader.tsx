import { MetricValue } from '@/components/ui/MetricValue';
import Link from 'next/link';
import { SESSION_COPY } from '@/lib/copy/session';
import { cn } from '@/lib/ui/cn';
import { metric } from '@/types/metric';

interface GuidedSessionHeaderProps {
  routineName: string;
  currentIndex: number | null;
  totalExercises: number;
  muscleGroup?: string | null;
}

/**
 * Active guided workout header with honest exercise progress.
 *
 * @param props Routine name plus current exercise metadata derived from the loaded routine.
 * @returns Header preserving the back affordance and showing progress only when derivable.
 * @example
 * <GuidedSessionHeader routineName="Full body" currentIndex={1} totalExercises={4} muscleGroup="Pecho" />
 */
export function GuidedSessionHeader({
  routineName,
  currentIndex,
  totalExercises,
  muscleGroup,
}: GuidedSessionHeaderProps) {
  const canShowProgress = currentIndex !== null && totalExercises > 0;

  return (
    <header className="mb-5 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-line">
      <div className="flex items-center justify-between gap-3">
        <Link href="/dashboard/today" className="text-sm font-medium text-brand hover:underline">
          ← Volver
        </Link>
        {muscleGroup ? (
          <span className="rounded-full bg-brand-muted px-3 py-1 text-xs font-semibold text-brand">
            {muscleGroup}
          </span>
        ) : null}
      </div>
      <h1 className="mt-3 text-xl font-bold tracking-[-0.03em] text-ink">{routineName}</h1>
      {canShowProgress ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm font-medium text-ink-muted">
            <MetricValue
              metric={metric(SESSION_COPY.exerciseProgress(currentIndex, totalExercises), 'atlas_computed')}
              label="Progreso de ejercicio"
            />
          </p>
          <div className="flex gap-1.5">
            {Array.from({ length: totalExercises }, (_, index) => {
              const isReached = index < currentIndex;
              return (
                <span
                  key={index}
                  aria-label={`Progreso de ejercicio ${index + 1}`}
                  className={cn(
                    'h-2 flex-1 rounded-full',
                    isReached ? 'bg-brand' : 'bg-canvas ring-1 ring-line',
                  )}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </header>
  );
}
