'use client';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { MetricValue } from '@/components/ui/MetricValue';
import { SESSION_COPY } from '@/lib/copy/session';
import { metric } from '@/types/metric';

type SetCheckListProps = {
  targetSets: number;
  completedCount: number;
  weight: string;
  onWeightChange: (value: string) => void;
  onCompleteSet: () => void;
  busy: boolean;
};

export function SetCheckList({
  targetSets,
  completedCount,
  weight,
  onWeightChange,
  onCompleteSet,
  busy,
}: SetCheckListProps) {
  const slots = Array.from({ length: targetSets }, (_, index) => index + 1);

  return (
    <div>
      <ol className="mb-4 space-y-2" data-testid="set-checklist">
        {slots.map((slot) => {
          const done = slot <= completedCount;
          return (
            <li
              key={slot}
              className="flex items-center justify-between rounded-md border border-line px-3 py-2"
              data-testid={done ? 'set-complete' : 'set-pending'}
            >
              <span className="text-sm text-ink">
                <MetricValue
                  metric={metric(SESSION_COPY.setProgress(slot, targetSets), 'atlas_computed')}
                  label="Progreso de serie"
                />
              </span>
              <span className="text-sm text-ink-muted" aria-hidden>
                {done ? '✓' : '○'}
              </span>
            </li>
          );
        })}
      </ol>
      {completedCount < targetSets ? (
        <div className="sticky bottom-app-cta z-20 space-y-3 rounded-lg bg-surface/95 p-3 shadow-card md:static md:bg-transparent md:p-0 md:shadow-none">
          <Input
            id="guided-weight"
            label={SESSION_COPY.weightLabel}
            type="text"
            inputMode="decimal"
            value={weight}
            onChange={(event) => onWeightChange(event.target.value)}
            data-testid="guided-weight-input"
          />
          <Button
            size="lg"
            className="min-h-12"
            onClick={onCompleteSet}
            disabled={busy || !weight.trim()}
            data-testid="complete-set-button"
          >
            {SESSION_COPY.completeSet}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
