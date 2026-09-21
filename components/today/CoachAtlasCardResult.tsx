import { Button } from '@/components/ui/Button';
import type { CoachAdaptationResult, CoachRoutineSummary } from '@/types/coach';

export type CoachDecisionAction = 'accepted' | 'rejected';
export type CoachDecisionStatus = 'applied' | 'discarded';

type CoachResultProps = {
  result: CoachAdaptationResult;
  canDecide: boolean;
  decisionLoading: CoachDecisionAction | null;
  decisionStatus: CoachDecisionStatus | null;
  onDecide: (decision: CoachDecisionAction) => Promise<void>;
};

const COPY = {
  original: 'Original',
  adapted: 'Adaptado',
  provenance: 'Sugerencia de Atlas',
  apply: 'Aplicar',
  discard: 'Descartar',
  applied: 'Aplicado',
  discarded: 'Descartado',
} as const;

/**
 * Renders the Coach Atlas preview result plus optional persistence decision controls.
 *
 * @param props Preview result, decision availability, current decision state, and decision callback.
 * @returns Accessible result summary with es-AR action copy.
 * @example
 * <CoachResult result={result} canDecide onDecide={decideRecommendation} decisionLoading={null} decisionStatus={null} />
 */
export function CoachResult({
  result,
  canDecide,
  decisionLoading,
  decisionStatus,
  onDecide,
}: CoachResultProps) {
  const disabled = decisionLoading !== null || decisionStatus !== null;

  return (
    <section className="mt-4 rounded-xl border border-line bg-canvas p-3" aria-label="Resultado de adaptación de Coach Atlas">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <SummaryBlock title={COPY.original} summary={result.original} />
        <SummaryBlock title={COPY.adapted} summary={result.adapted} />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink">{result.reason}</p>
      <p className="mt-2 text-xs text-ink-muted">{COPY.provenance}</p>
      {canDecide ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row" aria-busy={decisionLoading !== null}>
          <Button
            variant="success"
            size="md"
            className="flex-1 rounded-xl"
            disabled={disabled}
            aria-busy={decisionLoading === 'accepted'}
            onClick={() => void onDecide('accepted')}
          >
            {COPY.apply}
          </Button>
          <Button
            variant="secondary"
            size="md"
            className="flex-1 rounded-xl"
            disabled={disabled}
            aria-busy={decisionLoading === 'rejected'}
            onClick={() => void onDecide('rejected')}
          >
            {COPY.discard}
          </Button>
        </div>
      ) : null}
      {decisionStatus ? (
        <p className="mt-3 rounded-lg bg-success-muted px-3 py-2 text-sm font-medium text-success" role="status">
          {decisionStatus === 'applied' ? COPY.applied : COPY.discarded}
        </p>
      ) : null}
    </section>
  );
}

function SummaryBlock({ title, summary }: { title: string; summary: CoachRoutineSummary }) {
  return (
    <div className="rounded-lg bg-surface p-3">
      <p className="text-xs font-medium text-ink-muted">{title}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{formatSummary(summary)}</p>
    </div>
  );
}

function formatSummary(summary: CoachRoutineSummary): string {
  return `${summary.exerciseCount} ejercicios · ${summary.setCount} series · ${summary.estMinutes} min`;
}
