'use client';

import { WeekDayStrip } from '@/components/today/WeekDayStrip';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { MetricValue } from '@/components/ui/MetricValue';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { STREAK_COPY, STREAK_TEST_IDS } from '@/lib/copy/streak';
import { useStreak } from '@/hooks/useStreak';
import { useWeekConsistency } from '@/hooks/useWeekConsistency';
import { metric } from '@/types/metric';

const COPY = {
  heading: 'Consistencia Semanal',
  daysLabel: 'Tu semana',
  activeSuffix: 'días activos esta semana',
  activeSuffixSingular: 'día activo esta semana',
  activeHint: 'Cuenta los días con entrenamiento terminado o check-in.',
  retry: 'Reintentar',
} as const;

/**
 * Weekly section for the Today screen.
 *
 * Renders the real habit streak (current + longest, exposing the streak test ids
 * for the golden-path E2E) and drives {@link WeekDayStrip}
 * plus an active-days summary from `useWeekConsistency`. Every number is
 * `atlas_computed` (derived from the user's ended workouts and daily check-ins),
 * so nothing is fabricated (DATA HONESTY RULE). Loading and error states are handled
 * explicitly and never hide the failure behind a fake value.
 * @returns Weekly card with real streak, day strip and an honest active-days summary.
 * @example <TodayWeekCard />
 */
export function TodayWeekCard() {
  const { week, loading, error, reload } = useWeekConsistency();
  const { streak, loading: streakLoading, error: streakError } = useStreak();
  const isZeroStreak = streak ? streak.currentStreak === 0 && streak.longestStreak === 0 : false;
  const streakLabel = streak
    ? `🔥 Racha: ${streak.currentStreak} ${streak.currentStreak === 1 ? 'día' : 'días'}`
    : '🔥 Racha: sin registrar';

  return (
    <Card className="space-y-4 rounded-[1.75rem] p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-serif text-xl font-semibold text-ink">{COPY.heading}</h2>
        <p
          className="text-right text-sm font-semibold text-brand"
          role="status"
          data-testid={STREAK_TEST_IDS.chip}
        >
          {streakLoading
            ? 'Cargando racha…'
            : streakError || !streak
              ? 'Racha no disponible'
              : isZeroStreak
                ? STREAK_COPY.zeroTitle
                : streakLabel}
          {streak ? (
            <>
              <span data-testid={STREAK_TEST_IDS.current} className="sr-only">
                {streak.currentStreak}
              </span>
              <span data-testid={STREAK_TEST_IDS.longest} className="sr-only">
                {streak.longestStreak}
              </span>
            </>
          ) : null}
        </p>
      </div>
      <section className="space-y-3" aria-label={COPY.daysLabel}>
        <WeekDayStrip days={week?.days} />
        {loading ? (
          <LoadingState compact />
        ) : error ? (
          <div className="space-y-2">
            <ErrorState message={error} />
            <Button variant="secondary" size="sm" onClick={reload}>
              {COPY.retry}
            </Button>
          </div>
        ) : week ? (
          <div className="space-y-1">
            <p className="text-sm text-ink">
              <MetricValue
                metric={metric(week.activeCount, 'atlas_computed')}
                label="Días activos"
                className="font-semibold text-ink"
              />{' '}
              {week.activeCount === 1 ? COPY.activeSuffixSingular : COPY.activeSuffix}
            </p>
            <p className="text-xs text-ink-muted">{COPY.activeHint}</p>
          </div>
        ) : null}
      </section>
    </Card>
  );
}
