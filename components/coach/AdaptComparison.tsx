import { Card } from '@/components/ui/Card';
import { MetricValue } from '@/components/ui/MetricValue';
import { AdaptDeltaList } from '@/components/coach/AdaptDeltaList';
import { metric } from '@/types/metric';
import type { MetricSource } from '@/types/metric';
import type { CoachAdaptationResult, CoachRoutineSummary } from '@/types/coach';

export interface AdaptComparisonProps {
  result: CoachAdaptationResult;
  routineName: string;
}

/**
 * Displays the honest original-vs-adapted Coach Atlas proposal.
 *
 * @param props.result Coach adaptation result returned by the typed client.
 * @param props.routineName Human routine name from the route query.
 * @returns Comparison cards, sourced deltas, reason, and exercise detail.
 * @example
 * <AdaptComparison result={result} routineName="Torso" />
 */
export function AdaptComparison({ result, routineName }: AdaptComparisonProps) {
  const source = sourceFromResult(result.source);
  const minuteDelta = Math.max(0, result.original.estMinutes - result.adapted.estMinutes);
  const exerciseDelta = Math.max(0, result.original.exerciseCount - result.adapted.exerciseCount);
  const setDelta = Math.max(0, result.original.setCount - result.adapted.setCount);

  return (
    <div className="space-y-4">
      <Card className="space-y-4 rounded-xl">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Comparación</p>
          <h2 className="text-2xl font-bold tracking-[-0.03em] text-ink">{routineName}</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Summary title="Tu plan original" summary={result.original} source={source} />
          <Summary title="Propuesta Atlas" summary={result.adapted} source={source} />
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-canvas p-2">
          <DeltaPill value={`-${minuteDelta} min`} label="Minutos estimados ajustados" source={source} />
          <DeltaPill value={`-${exerciseDelta} ej`} label="Ejercicios ajustados" source={source} />
          <DeltaPill value={`-${setDelta} series`} label="Series ajustadas" source={source} />
        </div>
      </Card>

      <Card tone="brand" className="space-y-2 rounded-xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">Por qué</h2>
          <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-brand ring-1 ring-brand/20">
            {result.source === 'ai' ? 'Sugerencia de Atlas' : 'Calculado por Atlas'}
          </span>
        </div>
        <p className="text-sm leading-6 text-ink">{result.reason}</p>
      </Card>

      <AdaptDeltaList deltas={result.exerciseDeltas} source={source} />
    </div>
  );
}

function Summary({ title, summary, source }: { title: string; summary: CoachRoutineSummary; source: MetricSource }) {
  return (
    <div className="rounded-xl bg-canvas p-3 ring-1 ring-line">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <div className="mt-3 grid gap-2 text-sm">
        <MetricValue metric={metric(formatCount(summary.exerciseCount, 'ejercicio', 'ejercicios'), source)} label="Ejercicios" showSource />
        <MetricValue metric={metric(formatCount(summary.setCount, 'serie', 'series'), source)} label="Series" showSource />
        <MetricValue metric={metric(`${summary.estMinutes} min`, source)} label="Minutos estimados" showSource />
      </div>
    </div>
  );
}

function DeltaPill({ value, label, source }: { value: string; label: string; source: MetricSource }) {
  return (
    <div className="rounded-lg bg-surface p-2 text-center">
      <MetricValue metric={metric(value, source)} label={label} className="justify-center text-sm" />
    </div>
  );
}

function sourceFromResult(source: CoachAdaptationResult['source']): MetricSource {
  return source === 'ai' ? 'ai_recommendation' : 'atlas_computed';
}

function formatCount(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}
