'use client';

import { SESSION_COPY } from '@/lib/copy/session';
import { describeRecordedAmount, LEGACY_AMOUNT_LABEL } from '@/lib/format/amount';
import { canonicalSemantics } from '@/lib/progression/semantics';
import { cordobaDisplayDate } from '@/lib/time/cordoba';
import type { ExerciseSessionMemoryError } from '@/hooks/useExerciseSessionMemory';
import type {
  ExerciseSessionContext,
  ExerciseSessionSetSnapshot,
} from '@/types/exercise-session-memory';

/**
 * Mode-aware amount label for one remembered set. A declared bodyweight set
 * shows "peso corporal", assistance shows the assistance magnitude and a
 * per-side amount is not multiplied; a legacy row is labelled as a raw recorded
 * amount with no inferred meaning. Never "kg lifted".
 */
function rememberedAmountLabel(set: ExerciseSessionSetSnapshot): string {
  if (set.semanticCaptureVersion === null) {
    return `${set.weightKg} kg · ${LEGACY_AMOUNT_LABEL}`;
  }
  const canonical = canonicalSemantics(set.semanticCaptureVersion, {
    loadMode: set.loadMode,
    amountBasis: set.amountBasis,
    side: set.side,
    setPurpose: set.setPurpose,
    repCountBasis: set.repCountBasis,
  });
  if (canonical.status !== 'canonical') {
    return `${set.weightKg} kg · ${LEGACY_AMOUNT_LABEL}`;
  }
  return describeRecordedAmount(canonical.tuple, set.weightKg);
}

export interface LastCompletedPanelProps {
  context: ExerciseSessionContext | null;
  loading: boolean;
  error: ExerciseSessionMemoryError | null;
  onRetry: () => void;
}

/**
 * Read-only `Última vez` panel for the current exercise.
 *
 * Shows the previous completed sets and the previous note as raw records, each
 * labelled with its own Córdoba source date: the two may come from different
 * workouts. It never calculates a delta, never recommends a load and never
 * replaces an error with zeros. Loading/error are local to this panel, so set
 * logging is never blocked.
 *
 * @param props Bounded context plus local retry.
 * @returns The previous-encounter panel.
 */
export function LastCompletedPanel({
  context,
  loading,
  error,
  onRetry,
}: LastCompletedPanelProps) {
  const lastSets = context?.lastCompletedSets ?? null;
  const lastNote = context?.lastCompletedNote ?? null;
  const empty = lastSets === null && lastNote === null;

  return (
    <div
      data-testid="last-time-panel"
      className="mx-4 mt-4 min-w-0 rounded-2xl bg-canvas p-3"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
        {SESSION_COPY.lastTimeTitle}
      </p>

      {loading ? (
        <p
          data-testid="last-time-loading"
          role="status"
          aria-live="polite"
          className="mt-2 text-sm text-ink-muted"
        >
          {SESSION_COPY.lastTimeLoading}
        </p>
      ) : null}

      {!loading && error ? (
        <div role="alert" className="mt-2 space-y-2 rounded-xl bg-danger-muted p-3 text-sm text-danger">
          <p>{error.message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="min-h-11 rounded-lg border border-danger px-4 text-sm font-semibold text-danger"
          >
            {SESSION_COPY.lastTimeRetry}
          </button>
        </div>
      ) : null}

      {!loading && !error && empty ? (
        <p className="mt-2 text-sm text-ink-muted">{SESSION_COPY.lastTimeEmpty}</p>
      ) : null}

      {!loading && !error && !empty ? (
        <div className="mt-2 space-y-3">
          {lastSets ? (
            <section className="min-w-0">
              <p className="text-xs font-medium text-ink-muted">
                {SESSION_COPY.lastTimeSetsDate(
                  cordobaDisplayDate(new Date(lastSets.endedAt)),
                )}
              </p>
              <ul className="mt-1 min-w-0 space-y-1">
                {lastSets.sets.map((set) => (
                  <li
                    key={set.id}
                    data-testid="last-time-set"
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-sm"
                  >
                    <span className="text-ink-muted">
                      {SESSION_COPY.lastTimeSetLabel(set.setIndex)}
                    </span>
                    <span className="tabular-nums text-ink">
                      <span>{SESSION_COPY.lastTimeReps(set.reps)}</span>
                      <span aria-hidden> · </span>
                      <span>{rememberedAmountLabel(set)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {lastNote ? (
            <section className="min-w-0">
              <p className="text-xs font-medium text-ink-muted">
                {SESSION_COPY.lastTimeNoteDate(
                  cordobaDisplayDate(new Date(lastNote.endedAt)),
                )}
              </p>
              <p className="mt-1 break-words rounded-xl bg-surface px-3 py-2 text-sm text-ink">
                {lastNote.note}
              </p>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
