import { Card } from '@/components/ui/Card';
import { MetricValue } from '@/components/ui/MetricValue';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import type { HabitDoneMap } from '@/hooks/useHabits';
import { PROGRESS_COPY } from '@/lib/copy/progress';
import type { DailyCheckInResponse } from '@/lib/api/checkin';
import { metric } from '@/types/metric';

interface WellbeingCardProps {
  checkin: DailyCheckInResponse | null;
  loading: boolean;
  error: string | null;
}

interface HabitConsistencyCardProps {
  doneByKey: HabitDoneMap;
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
 * Honest empty state for strength evolution until a PR/volume source exists.
 *
 * @returns Strength card without fabricated chart data.
 * @example
 * <StrengthEvolutionCard />
 */
export function StrengthEvolutionCard() {
  return (
    <Card className="space-y-3 rounded-2xl p-5">
      <h2 className="text-base font-semibold text-ink">{PROGRESS_COPY.strength.title}</h2>
      <EmptyState
        title={PROGRESS_COPY.strength.emptyTitle}
        description={PROGRESS_COPY.strength.emptyBody}
      />
      <p className="text-xs leading-relaxed text-ink-muted">{PROGRESS_COPY.strength.emptyWhy}</p>
    </Card>
  );
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
    <Card className="space-y-4 rounded-2xl p-5">
      <h2 className="text-base font-semibold text-ink">{PROGRESS_COPY.wellbeing.title}</h2>
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
          <div aria-label={PROGRESS_COPY.wellbeing.moodLabel} className="rounded-xl bg-canvas p-3">
            <p className="text-xs font-semibold text-ink-muted">Ánimo</p>
            <MetricValue
              metric={metric(`${checkin.mood}/5`, 'user_input')}
              label={PROGRESS_COPY.wellbeing.moodLabel}
              className="mt-1 text-lg"
            />
          </div>
          <div aria-label={PROGRESS_COPY.wellbeing.energyLabel} className="rounded-xl bg-canvas p-3">
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

/**
 * Habits card that refuses to turn today-only toggles into fake consistency percentages.
 *
 * @param props Current habit hook state.
 * @returns Honest habits consistency empty state with optional today-only context.
 * @example
 * <HabitConsistencyCard doneByKey={doneByKey} loading={false} error={null} />
 */
export function HabitConsistencyCard({ doneByKey, loading, error }: HabitConsistencyCardProps) {
  const habitStates = Object.values(doneByKey);
  const completedToday = habitStates.filter(Boolean).length;
  const totalHabits = habitStates.length;

  return (
    <Card className="space-y-3 rounded-2xl p-5">
      <h2 className="text-base font-semibold text-ink">{PROGRESS_COPY.habits.title}</h2>
      {loading ? <LoadingState compact /> : null}
      {!loading && error ? <ErrorState message={error} /> : null}
      {!loading && !error ? (
        <>
          <EmptyState title={PROGRESS_COPY.habits.emptyTitle} description={PROGRESS_COPY.habits.emptyBody} />
          <p className="rounded-xl bg-canvas p-3 text-sm text-ink-muted">
            {PROGRESS_COPY.habits.todayOnly(completedToday, totalHabits)}
          </p>
        </>
      ) : null}
    </Card>
  );
}
