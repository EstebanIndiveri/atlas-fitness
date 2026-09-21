'use client';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SESSION_COPY } from '@/lib/copy/session';

type RestTimerProps = {
  remaining: number;
  totalSeconds?: number;
  motivator: string;
  onSkip: () => void;
  onAddThirtySeconds?: () => void;
};

function formatTimer(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Suggested rest timer card for the active guided-session state.
 *
 * @param props Remaining seconds, optional total duration, copy, and controls wired by the page.
 * @returns Mobile-first rest card with mm:ss timer, actions, and progress semantics.
 * @example
 * <RestTimer remaining={90} totalSeconds={120} motivator="Respirá" onSkip={() => {}} />
 */
export function RestTimer({
  remaining,
  totalSeconds = remaining,
  motivator,
  onSkip,
  onAddThirtySeconds,
}: RestTimerProps) {
  const progress = totalSeconds > 0
    ? Math.max(0, Math.min(100, Math.round((remaining / totalSeconds) * 100)))
    : 0;

  return (
    <Card className="mb-4 rounded-2xl border border-line p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-xl bg-brand-muted text-2xl" aria-hidden>
          ⏳
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            {SESSION_COPY.restTitle}
          </p>
          <p className="text-3xl font-bold tracking-[-0.04em] text-brand">
            <span data-testid="rest-timer">{formatTimer(remaining)}</span>
            <span className="ml-1 text-xs font-medium text-ink-muted">min</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onAddThirtySeconds}
            disabled={!onAddThirtySeconds}
            aria-label="Sumar 30 segundos al descanso"
          >
            {SESSION_COPY.addRestThirty}
          </Button>
          <Button variant="secondary" size="sm" onClick={onSkip} data-testid="skip-rest">
            {SESSION_COPY.skipRest}
          </Button>
        </div>
      </div>
      <p className="mt-2 text-sm text-ink" data-testid="rest-motivator">
        {motivator}
      </p>
      <div
        className="mt-3 h-2 rounded-full bg-canvas ring-1 ring-line"
        role="progressbar"
        aria-label="Progreso del descanso"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        data-testid="rest-progress"
      >
        <div className="h-full rounded-full bg-brand" style={{ width: `${progress}%` }} />
      </div>
    </Card>
  );
}
