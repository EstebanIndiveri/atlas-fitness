'use client';

import Link from 'next/link';

import { AtlasIcon } from '@/components/ui/AtlasIcon';
import type { AtlasIconName } from '@/components/ui/atlas-icons';
import { MetricValue } from '@/components/ui/MetricValue';
import { PROGRESSION_COPY } from '@/lib/copy/exercise-progression';
import { describeRecordedAmount } from '@/lib/format/amount';
import { useExerciseProgression } from '@/hooks/useExerciseProgression';
import { cordobaDisplayDate } from '@/lib/time/cordoba';
import { MOTION_ORIENTATION_CLASS } from '@/lib/ui/motion';
import { cn } from '@/lib/ui/cn';
import { metric } from '@/types/metric';
import type { ProgressionSupport } from '@/lib/session/progression-cohort';
import type { ProgressionComparison } from '@/types/progression';
import type {
  ExerciseProgression,
  ProgressionReadStatus,
  ProgressionSourceSet,
} from '@/types/progression-read';

export interface ExerciseProgressionPanelProps {
  exerciseId: number;
  support: ProgressionSupport;
}

/**
 * State visual grammar (brief §18). Each conclusion maps to one governed icon
 * and one semantic surface, so the state never depends on color alone:
 * baseline/below-best stay neutral history, `new_pr` is the reserved verified
 * accent (never brand/action green), `ties_best` a restrained verified sign.
 */
interface ComparisonVisual {
  icon: AtlasIconName;
  containerClassName: string;
  iconClassName: string;
}

const COMPARISON_VISUAL: Record<ProgressionComparison, ComparisonVisual> = {
  baseline: {
    icon: 'progression',
    containerClassName: 'bg-surface ring-1 ring-line',
    iconClassName: 'text-ink-muted',
  },
  new_pr: {
    icon: 'verified',
    containerClassName: 'bg-verified-muted ring-1 ring-verified',
    iconClassName: 'text-verified',
  },
  ties_best: {
    icon: 'tie',
    containerClassName: 'bg-surface ring-1 ring-line',
    iconClassName: 'text-verified',
  },
  below_best: {
    icon: 'history',
    containerClassName: 'bg-surface ring-1 ring-line',
    iconClassName: 'text-ink-muted',
  },
};

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

function ConclusionBlock({ comparison }: { comparison: ProgressionComparison | null }) {
  const effective = comparison ?? 'baseline';
  const visual = COMPARISON_VISUAL[effective];
  const label = PROGRESSION_COPY.comparison[effective];

  return (
    <div
      data-testid="progression-conclusion"
      data-state={effective}
      data-icon={visual.icon}
      className={cn(
        'flex items-start gap-3 rounded-xl px-3 py-3',
        visual.containerClassName,
      )}
    >
      <span className={cn('mt-0.5', visual.iconClassName)}>
        <AtlasIcon name={visual.icon} size="md" data-testid="progression-state-icon" />
      </span>
      <div className="min-w-0 space-y-1">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          {PROGRESSION_COPY.conclusionLabel}
        </p>
        <MetricValue metric={metric(label, 'atlas_computed')} showSource />
      </div>
    </div>
  );
}

function CohortLine({ data }: { data: ExerciseProgression }) {
  const { reps, amountBasis, side } = data.cohort;
  return (
    <p className="text-xs leading-relaxed text-ink-muted" data-testid="progression-cohort">
      {PROGRESSION_COPY.cohortLabel}:{' '}
      {PROGRESSION_COPY.cohortSummary(
        reps,
        PROGRESSION_COPY.amountBasisLabel[amountBasis],
        PROGRESSION_COPY.sideLabel[side],
      )}
    </p>
  );
}

function AbsenceBody({ readStatus }: { readStatus: Exclude<ProgressionReadStatus, 'ready'> }) {
  return (
    <div
      data-testid="progression-status"
      data-state={readStatus}
      data-icon="unknown"
      className="flex items-start gap-2 rounded-xl bg-unknown-muted px-3 py-2"
    >
      <span className="mt-0.5 shrink-0 text-unknown">
        <AtlasIcon name="unknown" size="sm" />
      </span>
      <p className="text-sm text-ink">{PROGRESSION_COPY.status[readStatus]}</p>
    </div>
  );
}

function ReadyBody({ data }: { data: ExerciseProgression }) {
  if (data.readStatus !== 'ready') {
    return <AbsenceBody readStatus={data.readStatus} />;
  }

  return (
    <div
      className={cn('space-y-3', MOTION_ORIENTATION_CLASS)}
      data-testid="progression-ready"
    >
      <ConclusionBlock comparison={data.comparison} />
      <CohortLine data={data} />
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
 * as a record, and shows only closed-history results. Presentation is a
 * persistent, non-celebratory state: the verified accent marks a fact, not an
 * event replay.
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
        <div
          data-testid="progression-unsupported"
          data-icon="unknown"
          className="mt-2 flex items-start gap-2 rounded-xl bg-unknown-muted px-3 py-2"
        >
          <span className="mt-0.5 shrink-0 text-unknown">
            <AtlasIcon name="unknown" size="sm" />
          </span>
          <p className="text-sm text-ink">{PROGRESSION_COPY.unsupported[support.reason]}</p>
        </div>
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
          data-testid="progression-error"
          data-icon="error"
          className="mt-2 space-y-2 rounded-xl bg-danger-muted p-3 text-sm text-danger"
        >
          <p className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0">
              <AtlasIcon name="error" size="sm" />
            </span>
            <span>{state.message}</span>
          </p>
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
