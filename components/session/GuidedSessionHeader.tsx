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
  elapsedSeconds?: number;
}

function formatElapsed(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Active guided workout header with honest exercise progress.
 *
 * @param props Routine name plus current exercise metadata derived from the loaded routine.
 * @returns Header preserving the back affordance and showing progress only when derivable.
 * @example
 * <GuidedSessionHeader routineName="Full body" currentIndex={1} totalExercises={4} elapsedSeconds={90} />
 */
export function GuidedSessionHeader({
  routineName,
  currentIndex,
  totalExercises,
  elapsedSeconds = 0,
}: GuidedSessionHeaderProps) {
  const canShowProgress = currentIndex !== null && totalExercises > 0;
  const progressLabel = canShowProgress
    ? SESSION_COPY.exerciseProgressTimer(currentIndex, totalExercises, formatElapsed(elapsedSeconds))
    : routineName;

  return (
    <header className="mb-5 space-y-3 bg-canvas pb-1">
      <div className="flex items-center justify-between gap-3">
        <Link href="/dashboard/today" className="text-sm font-medium text-ink hover:text-brand">
          {SESSION_COPY.pause}
        </Link>
        <div className="text-center">
          {canShowProgress ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              <MetricValue
                metric={metric(progressLabel, 'atlas_computed')}
                label="Progreso de ejercicio y tiempo"
              />
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="rounded-full px-2 py-1 text-xl leading-none text-ink-muted"
          aria-label="Más opciones de sesión"
          disabled
        >
          ⋮
        </button>
      </div>
      {canShowProgress ? (
        <div className="mx-auto flex max-w-44 gap-1.5">
          {Array.from({ length: totalExercises }, (_, index) => {
            const isReached = index < currentIndex;
            return (
              <span
                key={index}
                aria-label={`Progreso de ejercicio ${index + 1}`}
                className={cn(
                  'h-1.5 flex-1 rounded-full',
                  isReached ? 'bg-brand' : 'bg-line',
                )}
              />
            );
          })}
        </div>
      ) : null}
    </header>
  );
}
