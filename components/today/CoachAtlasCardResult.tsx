import type { CoachAdaptationResult, CoachRoutineSummary } from '@/types/coach';

const COPY = {
  original: 'Original',
  adapted: 'Adaptado',
  provenance: 'Sugerencia de Atlas',
} as const;

/**
 * Renders a Coach Atlas adaptation preview without implying that it was applied.
 *
 * @param result Preview result returned by Coach Atlas.
 * @returns Accessible original-vs-adapted summary.
 * @example
 * <CoachResult result={result} />
 */
export function CoachResult({ result }: { result: CoachAdaptationResult }) {
  return (
    <section className="rounded-xl border border-line bg-canvas p-3" aria-label="Vista previa de adaptación de Coach Atlas">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <SummaryBlock title={COPY.original} summary={result.original} />
        <SummaryBlock title={COPY.adapted} summary={result.adapted} />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink">{result.reason}</p>
      <p className="mt-2 text-xs text-ink-muted">{COPY.provenance}</p>
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
