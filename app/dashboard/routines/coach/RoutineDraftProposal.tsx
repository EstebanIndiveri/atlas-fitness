import { buttonClassName } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { MetricValue } from '@/components/ui/MetricValue';
import { UI_COPY } from '@/lib/copy/ui';
import { metric } from '@/types/metric';
import type { RoutineDraft } from '@/lib/ai/routine-draft';
import type { MetricSource } from '@/types/metric';

const COPY = UI_COPY.training.coachRoutine;

export interface RoutineDraftProposalProps {
  draft: RoutineDraft;
  daysPerWeek: number;
  busy: boolean;
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
  daysPerWeek,
  busy,
  onAccept,
  onAdjust,
}: RoutineDraftProposalProps) {
  const source = sourceFromDraft(draft);
  const totalSets = draft.exercises.reduce((sum, exercise) => sum + exercise.targetSets, 0);

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
          <SummaryPill value={formatCount(daysPerWeek, 'día', 'días')} label={COPY.daysMetric} source="user_input" />
          <SummaryPill
            value={formatCount(draft.exercises.length, 'ejercicio', 'ejercicios')}
            label={COPY.exercisesMetric}
            source={source}
          />
          <SummaryPill value={formatCount(totalSets, 'serie', 'series')} label={COPY.setsMetric} source={source} />
        </div>
      </Card>

      <Card tone="brand" className="space-y-2 rounded-xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">{COPY.whyTitle}</h2>
          <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-brand ring-1 ring-brand/20">
            {source === 'ai_recommendation' ? COPY.aiSource : COPY.computedSource}
          </span>
        </div>
        <p className="text-sm leading-6 text-ink">{draft.reason}</p>
      </Card>

      <Card className="space-y-3 rounded-xl">
        <h2 className="text-lg font-bold text-ink">{COPY.exerciseBreakdownTitle}</h2>
        <ul className="space-y-2">
          {draft.exercises.map((exercise) => (
            <li key={exercise.exerciseId} className="rounded-xl bg-canvas p-3 ring-1 ring-line">
              <p className="font-semibold text-ink">{exercise.exerciseName}</p>
              <p className="text-sm text-ink-muted">
                {exercise.muscleGroup} · {exercise.targetSets}×{exercise.targetReps}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" className={buttonClassName({ size: 'lg' })} disabled={busy} onClick={onAccept}>
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

function SummaryPill({ value, label, source }: { value: string; label: string; source: MetricSource }) {
  return (
    <div className="rounded-lg bg-surface p-3 text-center">
      <MetricValue metric={metric(value, source)} label={label} showSource className="flex-col items-center gap-1" />
    </div>
  );
}

function sourceFromDraft(draft: RoutineDraft): MetricSource {
  return draft.source === 'gemini' ? 'ai_recommendation' : 'atlas_computed';
}

function formatCount(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}
