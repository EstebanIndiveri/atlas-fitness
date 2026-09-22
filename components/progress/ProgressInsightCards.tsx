import Link from 'next/link';

import { Card } from '@/components/ui/Card';
import { MetricValue } from '@/components/ui/MetricValue';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import type { HabitDoneMap } from '@/hooks/useHabits';
import { PROGRESS_COPY } from '@/lib/copy/progress';
import type { StrengthProgressSummary, StrengthVolumePoint } from '@/lib/services/strength-progress';
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

interface StrengthEvolutionCardProps {
  strength: StrengthProgressSummary;
}

const ENERGY_LABEL = {
  low: PROGRESS_COPY.wellbeing.low,
  medium: PROGRESS_COPY.wellbeing.medium,
  high: PROGRESS_COPY.wellbeing.high,
} as const;

interface StrengthChartPoint {
  key: string;
  x: number;
  y: number;
}

interface StrengthChart {
  path: string | null;
  points: StrengthChartPoint[];
}

function formatEnergyLabel(energy: string | null): string {
  if (energy === 'low' || energy === 'medium' || energy === 'high') {
    return ENERGY_LABEL[energy];
  }
  return 'Sin dato';
}

function buildStrengthChart(points: StrengthVolumePoint[]): StrengthChart {
  if (points.length === 0) {
    return { path: null, points: [] };
  }

  const volumes = points.map((point) => Number.parseFloat(point.totalVolumeKg));
  const minVolume = Math.min(...volumes);
  const maxVolume = Math.max(...volumes);
  const volumeRange = maxVolume - minVolume || 1;
  const chartPoints = points.map((point, index): StrengthChartPoint => {
    const x = points.length === 1 ? 140 : 16 + (index / (points.length - 1)) * 248;
    const y = 96 - ((Number.parseFloat(point.totalVolumeKg) - minVolume) / volumeRange) * 72;
    return { key: `${point.workoutId}-${point.localDate}`, x, y };
  });

  const path = chartPoints.length > 1
    ? chartPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
    : `M ${chartPoints[0].x - 10} ${chartPoints[0].y} L ${chartPoints[0].x + 10} ${chartPoints[0].y}`;

  return { path, points: chartPoints };
}

/**
 * Lightweight SVG line chart for real per-session strength volume.
 *
 * @param props Strength progression backed by persisted workout sets.
 * @returns Strength card with a real volume chart or an honest empty state.
 * @example
 * <StrengthEvolutionCard strength={summary.strength} />
 */
export function StrengthEvolutionCard({ strength }: StrengthEvolutionCardProps) {
  const chart = buildStrengthChart(strength.points);
  const latestPoint = strength.points.at(-1) ?? null;

  return (
    <Card className="space-y-4 rounded-[28px] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">{PROGRESS_COPY.strength.title}</h2>
        <Link href="/dashboard/routines" className="shrink-0 text-xs font-semibold text-brand">
          Ver ejercicios ▸
        </Link>
      </div>
      {!strength.hasLoggedSets ? (
        <>
          <EmptyState
            title={PROGRESS_COPY.strength.emptyTitle}
            description={PROGRESS_COPY.strength.emptyBody}
          />
          <p className="text-xs leading-relaxed text-ink-muted">{PROGRESS_COPY.strength.emptyWhy}</p>
        </>
      ) : null}
      {strength.hasLoggedSets ? (
        <>
          <div
            aria-label={PROGRESS_COPY.strength.volumeLabel}
            className="flex items-start justify-between gap-3 rounded-2xl bg-canvas p-3.5"
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink-muted">{PROGRESS_COPY.strength.volumeLabel}</p>
              <MetricValue
                metric={metric(`${strength.latestVolumeKg ?? '0'} kg`, 'atlas_computed')}
                label={PROGRESS_COPY.strength.volumeLabel}
                showSource
                className="mt-1 flex flex-wrap text-3xl leading-tight"
              />
            </div>
            <span className="shrink-0 rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-brand-foreground">
              {strength.trendLabel}
            </span>
          </div>
          <svg
            role="img"
            aria-label={PROGRESS_COPY.strength.chartLabel}
            viewBox="0 0 280 120"
            className="h-32 w-full overflow-visible"
          >
            <path d="M16 96H264" className="stroke-line" strokeWidth="1" fill="none" />
            {chart.path ? (
              <path
                data-testid="strength-chart-series"
                d={chart.path}
                className="stroke-brand"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />
            ) : null}
            {chart.points.map((point) => (
              <circle key={point.key} cx={point.x} cy={point.y} r="4.5" className="fill-brand" />
            ))}
          </svg>
          {latestPoint ? (
            <p className="text-xs leading-relaxed text-ink-muted">
              Última sesión: {latestPoint.totalVolumeKg} kg · {latestPoint.completedSets}{' '}
              {latestPoint.completedSets === 1 ? 'serie' : 'series'}
            </p>
          ) : null}
          {strength.points.length === 1 ? (
            <p className="text-xs leading-relaxed text-ink-muted">{PROGRESS_COPY.strength.startingPointBody}</p>
          ) : null}
        </>
      ) : null}
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
    <Card className="space-y-4 rounded-[28px] p-5">
      <div>
        <h2 className="text-base font-semibold text-ink">{PROGRESS_COPY.wellbeing.title}</h2>
        <p className="mt-1 text-sm text-ink-muted">Basado en tu check-in registrado.</p>
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
    <Card className="space-y-3 rounded-[28px] p-5">
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
