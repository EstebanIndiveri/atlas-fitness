'use client';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { STREAK_COPY, STREAK_TEST_IDS } from '@/lib/copy/streak';
import { useStreak } from '@/hooks/useStreak';
import {
  daysLabel,
  streakAriaLabel,
  streakDelightMessage,
  streakTone,
} from '@/lib/streak/presentation';
import { cn } from '@/lib/ui/cn';
import type { StreakStats } from '@/types/streak';

type StreakChipViewProps = {
  streak: StreakStats;
};

export function StreakChipView({ streak }: StreakChipViewProps) {
  const tone = streakTone(streak.currentStreak, streak.longestStreak);
  const message = streakDelightMessage(streak.currentStreak, streak.longestStreak);
  const mark = tone === 'zero' ? '○' : '🔥';

  return (
    <Card
      tone={tone === 'zero' ? 'surface' : 'brand'}
      className="mb-6 p-4"
      data-testid={STREAK_TEST_IDS.chip}
      role="status"
      aria-label={streakAriaLabel(streak.currentStreak, streak.longestStreak)}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface text-2xl',
            tone !== 'zero' && 'streak-pop',
          )}
          aria-hidden
        >
          {mark}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink">
              {tone === 'zero' ? STREAK_COPY.zeroTitle : STREAK_COPY.currentLabel}
              {': '}
              <span data-testid={STREAK_TEST_IDS.current} className="text-title font-bold tabular-nums">
                {streak.currentStreak}
              </span>{' '}
              {daysLabel(streak.currentStreak)}
            </p>
            {tone === 'record' ? (
              <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-brand-foreground">
                {STREAK_COPY.recordBadge}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {STREAK_COPY.longestLabel}:{' '}
            <span data-testid={STREAK_TEST_IDS.longest} className="font-medium text-ink tabular-nums">
              {streak.longestStreak}
            </span>{' '}
            {daysLabel(streak.longestStreak)}
          </p>
          <p className="mt-2 text-xs text-ink-muted">{message}</p>
        </div>
      </div>
    </Card>
  );
}

export function StreakChip() {
  const { streak, loading, error, reload } = useStreak();

  if (loading) {
    return (
      <Card className="mb-6 p-4" data-testid={STREAK_TEST_IDS.chip} aria-busy="true">
        <LoadingState compact label={STREAK_COPY.loading} />
      </Card>
    );
  }

  if (error || !streak) {
    return (
      <div className="mb-6" data-testid={STREAK_TEST_IDS.chip}>
        <ErrorState message={error ?? STREAK_COPY.error} />
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={() => void reload()}
          data-testid={STREAK_TEST_IDS.retry}
        >
          {STREAK_COPY.retry}
        </Button>
      </div>
    );
  }

  return <StreakChipView streak={streak} />;
}
