import { buttonClassName } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { MetricValue } from '@/components/ui/MetricValue';
import { RoutineDraftExerciseEditor } from '@/app/dashboard/routines/coach/RoutineDraftExerciseEditor';
import { maxSetsForSession } from '@/lib/ai/routine-draft-selection';
import { UI_COPY } from '@/lib/copy/ui';
import { metric } from '@/types/metric';
import type { RoutineDraft, RoutineDraftCatalogItem } from '@/lib/ai/routine-draft';
import type { MetricSource } from '@/types/metric';

const COPY = UI_COPY.training.coachRoutine;

export interface RoutineDraftProposalProps {
  draft: RoutineDraft;
  sessionLengthMinutes: number;
  busy: boolean;
  onDraftChange: (draft: RoutineDraft) => void;
  onLoadCandidates: () => Promise<RoutineDraftCatalogItem[]>;
  onAccept: () => void;
  onAdjust: () => void;
}

/**
 * Presents a generated Coach Atlas routine draft with sourced metrics and rationale.
 *
 * @param props Draft, submitted brief summary, and creation callbacks.
 * @returns Coach Atlas proposal, reason card, exercise detail list, and CTAs.
 * @example
 * <RoutineDraftProposal draft={draft} daysPerWeek={3} busy={false} onAccept={save} onAdjust={reset} />
 */
export function RoutineDraftProposal({
  draft,
  sessionLengthMinutes,
  busy,
  onDraftChange,
  onLoadCandidates,
  onAccept,
  onAdjust,
}: RoutineDraftProposalProps) {
  const totalSets = draft.exercises.reduce((sum, exercise) => sum + exercise.targetSets, 0);
  const hasInvalidTargets = draft.exercises.some((exercise) => (
    !Number.isInteger(exercise.targetSets) || exercise.targetSets < 1 || exercise.targetSets > 8
    || !Number.isInteger(exercise.targetReps) || exercise.targetReps < 1 || exercise.targetReps > 30
  ));
  const totalRepetitions = draft.exercises.reduce(
    (sum, exercise) => sum + exercise.targetSets * exercise.targetReps,
    0,
  );
  const exceedsSessionVolume = totalSets > maxSetsForSession(sessionLengthMinutes)
    || totalRepetitions > sessionLengthMinutes * 12;
  const canCreate = draft.exercises.length > 0 && !hasInvalidTargets && !exceedsSessionVolume;

  return (
    <div className="space-y-4">
      <Card className="space-y-4 rounded-xl">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            {COPY.proposalTitle}
          </p>
          <h2 className="text-2xl font-bold tracking-[-0.03em] text-ink">{draft.name}</h2>
          <p className="text-sm leading-6 text-ink-muted">{draft.description}</p>
        </div>
        <div className="grid gap-2 rounded-xl bg-canvas p-2 sm:grid-cols-3">
          <SummaryPill
            value={formatCount(sessionLengthMinutes, 'minuto', 'minutos')}
            label={COPY.sessionDurationMetric}
          />
          <SummaryPill
            value={formatCount(draft.exercises.length, 'ejercicio', 'ejercicios')}
            label={COPY.exercisesMetric}
            source="atlas_computed"
          />
          <SummaryPill
            value={formatCount(totalSets, 'serie', 'series')}
            label={COPY.setsMetric}
            source="atlas_computed"
          />
        </div>
      </Card>

      <Card tone="brand" className="space-y-2 rounded-xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">{COPY.whyTitle}</h2>
          <span
            aria-label={`${COPY.proposalSourceLabel}: ${draft.source}`}
            className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-brand ring-1 ring-brand/20"
          >
            {draft.source === 'gemini' ? COPY.geminiSource : COPY.fallbackSource}
          </span>
        </div>
        <p className="text-sm leading-6 text-ink">{draft.reason}</p>
      </Card>

      <RoutineDraftExerciseEditor
        draft={draft}
        busy={busy}
        hasInvalidTargets={hasInvalidTargets}
        onDraftChange={onDraftChange}
        onLoadCandidates={onLoadCandidates}
      />
      {exceedsSessionVolume ? (
        <p role="alert" className="text-sm text-danger">{COPY.sessionVolumeExceeded}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          className={buttonClassName({ size: 'lg' })}
          disabled={busy || !canCreate}
          onClick={onAccept}
        >
          {busy ? COPY.creating : COPY.accept}
        </button>
        <button
          type="button"
          className={buttonClassName({ variant: 'secondary', size: 'lg' })}
          disabled={busy}
          onClick={onAdjust}
        >
          {COPY.adjustBrief}
        </button>
      </div>
    </div>
  );
}

function SummaryPill({
  value,
  label,
  source,
}: {
  value: string;
  label: string;
  source?: MetricSource;
}) {
  return (
    <div className="rounded-lg bg-surface p-3 text-center">
      {source ? (
        <MetricValue metric={metric(value, source)} label={label} showSource className="flex-col items-center gap-1" />
      ) : (
        <div className="flex flex-col items-center gap-1">
          <span className="font-medium text-ink">{value}</span>
          <span className="text-xs text-ink-muted">{label}</span>
        </div>
      )}
    </div>
  );
}

function formatCount(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}
