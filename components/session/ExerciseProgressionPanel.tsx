'use client';

import Link from 'next/link';

import { MetricValue } from '@/components/ui/MetricValue';
import { PROGRESSION_COPY } from '@/lib/copy/exercise-progression';
import { describeRecordedAmount } from '@/lib/format/amount';
import { useExerciseProgression } from '@/hooks/useExerciseProgression';
import { cordobaDisplayDate } from '@/lib/time/cordoba';
import { metric } from '@/types/metric';
import type { ProgressionSupport } from '@/lib/session/progression-cohort';
import type {
  ExerciseProgression,
  ProgressionSourceSet,
} from '@/types/progression-read';

export interface ExerciseProgressionPanelProps {
  exerciseId: number;
  support: ProgressionSupport;
}

function sourceSetLabel(set: ProgressionSourceSet): string {
  return describeRecordedAmount(
    {
      loadMode: set.semantics.loadMode,
      amountBasis: set.semantics.amountBasis,
      side: set.semantics.side,
      setPurpose: set.semantics.setPurpose,
      repCountBasis: set.semantics.repCountBasis,
    },
    set.weightKg,
  );
}

function SourceSetRow({ label, set }: { label: string; set: ProgressionSourceSet }) {
  return (
    <li className="rounded-xl bg-surface px-3 py-2 ring-1 ring-line">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </p>
      <p className="mt-1 text-sm text-ink">
        {PROGRESSION_COPY.reps(set.reps)} · {sourceSetLabel(set)}
      </p>
      <p className="mt-0.5 text-xs text-ink-muted">
        {cordobaDisplayDate(new Date(set.endedAt))}
      </p>
      <Link
        href={`/dashboard/workout/${set.workoutId}`}
        className="mt-1 inline-block text-xs font-semibold text-brand hover:underline"
      >
        {PROGRESSION_COPY.sourceWorkoutLink}
      </Link>
    </li>
  );
}

function ReadyBody({ data }: { data: ExerciseProgression }) {
  if (data.readStatus !== 'ready') {
    const message = PROGRESSION_COPY.status[data.readStatus];
    return (
      <p className="text-sm text-ink-muted" data-testid="progression-status">
        {message}
      </p>
    );
  }

  const conclusion = data.comparison
    ? PROGRESSION_COPY.comparison[data.comparison]
    : PROGRESSION_COPY.comparison.baseline;

  return (
    <div className="space-y-3" data-testid="progression-ready">
      <p
        className="flex flex-wrap items-baseline gap-2 rounded-xl bg-brand-muted/60 px-3 py-2 text-sm text-ink"
        data-testid="progression-conclusion"
      >
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">
          {PROGRESSION_COPY.conclusionLabel}
        </span>
        <MetricValue metric={metric(conclusion, 'atlas_computed')} showSource />
      </p>
      <ul className="space-y-2">
        {data.currentRepresentative ? (
          <SourceSetRow label={PROGRESSION_COPY.sourceLabel} set={data.currentRepresentative} />
        ) : null}
        {data.previousComparableRepresentative ? (
          <SourceSetRow
            label={PROGRESSION_COPY.previousLabel}
            set={data.previousComparableRepresentative}
          />
        ) : null}
        {data.currentBest ? (
          <SourceSetRow label={PROGRESSION_COPY.bestLabel} set={data.currentBest} />
        ) : null}
      </ul>
    </div>
  );
}

/**
 * Narrow, truthful per-exercise progression surface (v0.12).
 *
 * It complements “Última vez” (raw last completed session) with the versioned
 * comparable read model for exactly one external cohort. It never requests a
 * cohort the current visible semantics do not support, never treats the open set
 * as a record, and shows only closed-history results.
 *
 * @param props Exact exercise id plus the resolved cohort support.
 * @returns The comparable progression card, or a truthful non-comparable state.
 * @example
 * <ExerciseProgressionPanel exerciseId={3} support={{ status: 'supported', cohort }} />
 */
export function ExerciseProgressionPanel({ exerciseId, support }: ExerciseProgressionPanelProps) {
  const cohort = support.status === 'supported' ? support.cohort : null;
  const { state, reload } = useExerciseProgression({ exerciseId, cohort });
  const loading = support.status === 'supported' && (state.status === 'idle' || state.status === 'loading');

  return (
    <section
      data-testid="exercise-progression-panel"
      className="mx-4 mt-4 min-w-0 rounded-2xl bg-canvas p-3"
      aria-label={PROGRESSION_COPY.title}
    >
      <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
        {PROGRESSION_COPY.title}
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-ink-muted">
        {PROGRESSION_COPY.metricExplanation}
      </p>
      <p className="mt-1 text-[0.68rem] leading-relaxed text-ink-muted">
        {PROGRESSION_COPY.closedHistoryNote}
      </p>

      {support.status === 'unsupported' ? (
        <p className="mt-2 text-sm text-ink-muted" data-testid="progression-unsupported">
          {PROGRESSION_COPY.unsupported[support.reason]}
        </p>
      ) : null}

      {loading ? (
        <p
          className="mt-2 text-sm text-ink-muted"
          role="status"
          aria-live="polite"
          data-testid="progression-loading"
        >
          {PROGRESSION_COPY.loading}
        </p>
      ) : null}

      {support.status === 'supported' && state.status === 'error' ? (
        <div
          role="alert"
          className="mt-2 space-y-2 rounded-xl bg-danger-muted p-3 text-sm text-danger"
        >
          <p>{state.message}</p>
          <button
            type="button"
            onClick={reload}
            className="min-h-11 rounded-lg border border-danger px-4 text-sm font-semibold text-danger"
          >
            {PROGRESSION_COPY.retry}
          </button>
        </div>
      ) : null}

      {support.status === 'supported' && state.status === 'ready' ? (
        <div className="mt-2">
          <ReadyBody data={state.data} />
        </div>
      ) : null}
    </section>
  );
}
