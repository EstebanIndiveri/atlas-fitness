import type { JSX } from 'react';

import { Button } from '@/components/ui/Button';
import { MetricValue } from '@/components/ui/MetricValue';
import { ErrorState } from '@/components/ui/states';
import { cn } from '@/lib/ui/cn';
import { metric } from '@/types/metric';
import type { RoutineDetail } from '@/lib/api/routine-detail';

interface CompletionMeterProps {
  completed: number;
  total: number;
  label: string;
  unit: string;
  doneLabel: string;
}

interface RetryableErrorProps {
  message: string;
  onRetry: () => void;
  retryLabel: string;
  compact?: boolean;
}

/**
 * Small gym/home pill for the Today workout hero.
 * @returns A sourced routine-kind label.
 */
export function KindPill({ kind, gymLabel, homeLabel }: { kind: RoutineDetail['kind']; gymLabel: string; homeLabel: string }): JSX.Element {
  return (
    <span className="max-w-full break-words rounded-full bg-surface/80 px-3 py-1 text-xs font-medium text-ink ring-1 ring-line">
      {kind === 'gym' ? gymLabel : homeLabel}
    </span>
  );
}

/**
 * Plan-goal pill shown only when the real Today payload includes a goal.
 * @returns An accessible goal pill.
 */
export function GoalPill({ goal, label }: { goal: string; label: string }): JSX.Element {
  return (
    <span
      className="max-w-full break-words rounded-full bg-brand/12 px-3 py-1 text-xs font-semibold text-brand ring-1 ring-brand/30"
      aria-label={`${label}: ${goal}`}
    >
      {goal}
    </span>
  );
}

/**
 * Deterministic day-reason note shown only when provided by `/api/today`.
 * @returns An honest reason block.
 */
export function ReasonNote({ reason, label }: { reason: string; label: string }): JSX.Element {
  return (
    <div
      className="flex items-start gap-2 rounded-lg bg-surface/60 px-3 py-2 text-sm text-ink-muted ring-1 ring-line"
      aria-label={`${label}: ${reason}`}
    >
      <span className="mt-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand">
        {label}
      </span>
      <span className="leading-5">{reason}</span>
    </div>
  );
}

/**
 * Honest completion meter based on real completed/total exercise counts.
 * @returns A progress meter without fabricated percentages.
 */
export function CompletionMeter({ completed, total, label, unit, doneLabel }: CompletionMeterProps): JSX.Element {
  const isDone = completed >= total;
  const summary = `${completed} de ${total} ${unit}`;

  return (
    <div className="relative space-y-2" data-testid="completion-meter">
      <div className="flex items-center justify-between text-sm">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
          {label}
        </span>
        <MetricValue
          metric={metric(summary, 'atlas_computed')}
          label={label}
          className="font-medium text-ink"
        />
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-canvas ring-1 ring-line"
        role="progressbar"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-500"
          style={{ width: `${(completed / total) * 100}%` }}
        />
      </div>
      {isDone ? <p className="text-xs font-medium text-success">{doneLabel}</p> : null}
    </div>
  );
}

/**
 * Figma-style metric pills derived from real routine detail.
 * @returns Exercise and set pills with metric provenance; duration is omitted until sourced.
 */
export function StatsRow({ exercises, series }: { exercises: number; series: number }): JSX.Element {
  const items = [
    { icon: '↗', value: `${exercises} ejercicios`, label: 'Ejercicios' },
    { icon: '⇄', value: `${series} series`, label: 'Series' },
  ];

  return (
    <div className="relative flex flex-wrap items-center gap-2 text-sm text-ink">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-1.5 rounded-full bg-surface/75 px-3 py-1.5 ring-1 ring-line"
          aria-label={item.label}
        >
          <span aria-hidden="true">{item.icon}</span>
          <MetricValue
            metric={metric(item.value, 'atlas_computed')}
            label={item.label}
            className="font-medium"
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Reusable retry block for Today hero load failures.
 * @returns Error state plus a retry button.
 */
export function RetryableError({ message, onRetry, retryLabel, compact = false }: RetryableErrorProps): JSX.Element {
  return (
    <div className={cn('space-y-3', compact && 'rounded-lg bg-surface/60 p-3')}>
      <ErrorState message={message} />
      <Button variant="secondary" onClick={onRetry}>{retryLabel}</Button>
    </div>
  );
}
