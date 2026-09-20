import { MetricValue } from '@/components/ui/MetricValue';
import { metric } from '@/types/metric';
import type { MetricSource } from '@/types/metric';
import type { CoachExerciseDelta, CoachExerciseDeltaAction } from '@/types/coach';

type DeltaGroup = {
  action: CoachExerciseDeltaAction;
  title: string;
  ariaLabel: string;
  empty: string;
};

const GROUPS: readonly DeltaGroup[] = [
  { action: 'reduced', title: 'Reducidos', ariaLabel: 'Ejercicios reducidos', empty: 'Sin reducciones.' },
  { action: 'removed', title: 'Quitados', ariaLabel: 'Ejercicios quitados', empty: 'Sin ejercicios quitados.' },
  { action: 'kept', title: 'Mantenidos', ariaLabel: 'Ejercicios mantenidos', empty: 'Sin ejercicios mantenidos.' },
] as const;

/**
 * Groups exercise-level adaptation deltas by action with sourced set counts.
 *
 * @param props.deltas Exercise changes returned by Coach Atlas.
 * @param props.source Metric provenance derived from the adaptation source.
 * @returns Grouped detail list for kept, reduced, and removed exercises.
 * @example
 * <AdaptDeltaList deltas={result.exerciseDeltas} source="atlas_computed" />
 */
export function AdaptDeltaList({ deltas, source }: { deltas: CoachExerciseDelta[]; source: MetricSource }) {
  return (
    <section className="space-y-3" aria-labelledby="adapt-delta-title">
      <h2 id="adapt-delta-title" className="text-lg font-bold text-ink">Detalle del ajuste</h2>
      {GROUPS.map((group) => {
        const items = deltas.filter((delta) => delta.action === group.action);
        return (
          <div key={group.action} className="rounded-xl bg-surface p-3 ring-1 ring-line">
            <h3 className="text-sm font-semibold text-ink">{group.title}</h3>
            {items.length > 0 ? (
              <ul aria-label={group.ariaLabel} className="mt-2 space-y-2">
                {items.map((delta) => (
                  <li key={delta.exerciseId} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-ink">{delta.name}</span>
                    <MetricValue
                      metric={metric(`${delta.fromSets} → ${delta.toSets} series`, source)}
                      label={`Series de ${delta.name}`}
                      showSource={false}
                      className="shrink-0 text-ink-muted"
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">{group.empty}</p>
            )}
          </div>
        );
      })}
    </section>
  );
}
