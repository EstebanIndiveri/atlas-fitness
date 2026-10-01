import { Card } from '@/components/ui/Card';
import { MetricValue } from '@/components/ui/MetricValue';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { PROGRESS_COPY } from '@/lib/copy/progress';
import type { DailyCheckInResponse } from '@/lib/api/checkin';
import { metric } from '@/types/metric';

/**
 * Progress insight cards backed by real Atlas data.
 *
 * The former `StrengthEvolutionCard` charted mixed-mode session volume as a
 * "strength" trend and was retired in v0.12: a bare `weight_kg` cannot be
 * summed across load modes/bases, so no truthful strength chart can be derived
 * from it. A future chart must consume the versioned progression read model.
 */
interface WellbeingCardProps {
  checkin: DailyCheckInResponse | null;
  loading: boolean;
  error: string | null;
}

const ENERGY_LABEL = {
  low: PROGRESS_COPY.wellbeing.low,
  medium: PROGRESS_COPY.wellbeing.medium,
  high: PROGRESS_COPY.wellbeing.high,
} as const;

function formatEnergyLabel(energy: string | null): string {
  if (energy === 'low' || energy === 'medium' || energy === 'high') {
    return ENERGY_LABEL[energy];
  }
  return 'Sin dato';
}

/**
 * Today wellbeing card backed by the real daily check-in hook.
 *
 * @param props Check-in data plus loading/error states.
 * @returns Wellbeing summary or honest empty/error state.
 * @example
 * <WellbeingCard checkin={checkin} loading={false} error={null} />
 */
export function WellbeingCard({ checkin, loading, error }: WellbeingCardProps) {
  return (
    <Card className="space-y-4 rounded-[28px] p-5">
      <div>
        <h2 className="text-base font-semibold text-ink">{PROGRESS_COPY.wellbeing.title}</h2>
        <p className="mt-1 text-sm text-ink-muted">{PROGRESS_COPY.wellbeing.windowLabel}</p>
      </div>
      {loading ? <LoadingState compact /> : null}
      {!loading && error ? <ErrorState message={error} /> : null}
      {!loading && !error && !checkin ? (
        <EmptyState
          title={PROGRESS_COPY.wellbeing.emptyTitle}
          description={PROGRESS_COPY.wellbeing.emptyBody}
        />
      ) : null}
      {!loading && !error && checkin ? (
        <div className="grid grid-cols-2 gap-3">
          <div aria-label={PROGRESS_COPY.wellbeing.moodLabel} className="rounded-2xl bg-canvas p-3.5">
            <p className="text-xs font-semibold text-ink-muted">Ánimo</p>
            <MetricValue
              metric={metric(`${checkin.mood}/5`, 'user_input')}
              label={PROGRESS_COPY.wellbeing.moodLabel}
              className="mt-1 text-lg"
            />
          </div>
          <div aria-label={PROGRESS_COPY.wellbeing.energyLabel} className="rounded-2xl bg-canvas p-3.5">
            <p className="text-xs font-semibold text-ink-muted">Energía</p>
            <MetricValue
              metric={metric(formatEnergyLabel(checkin.energy), 'user_input')}
              label={PROGRESS_COPY.wellbeing.energyLabel}
              className="mt-1 text-lg"
            />
          </div>
          {checkin.note ? (
            <p className="col-span-2 rounded-xl bg-canvas p-3 text-sm text-ink-muted">
              <span className="sr-only">{PROGRESS_COPY.wellbeing.noteLabel}: </span>
              {checkin.note}
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
