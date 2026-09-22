import type { JSX } from 'react';

import { MetricValue } from '@/components/ui/MetricValue';
import { formatHydrationLiters } from '@/lib/format/hydration';
import { cn } from '@/lib/ui/cn';
import { isQuantitativeHabitKey } from '@/types/habit';
import { metric } from '@/types/metric';
import type { HabitPreview } from '@/components/today/HabitPreviewRow';
import type { QuantitativeHabitKey } from '@/types/habit';

const COPY = {
  add: 'Sumar',
  step: '0,25 L',
  reset: 'Reiniciar',
  empty: 'Sin registrar hoy',
  registered: 'Registrado hoy',
} as const;

interface HydrationHabitRowProps {
  habit: HabitPreview;
  amount: string | null;
  onAdd: (habitKey: QuantitativeHabitKey) => void;
  onClear: (habitKey: QuantitativeHabitKey) => void;
  disabled?: boolean;
}

/**
 * Quantitative habit row for the Today screen (e.g. hydration in liters).
 *
 * Renders the real amount the user has logged today as a sourced metric
 * (`source: user_input`) plus a stepper to add {@link COPY.step}. Atlas never
 * shows a fabricated target or completion ratio for it (DATA HONESTY RULE);
 * when nothing is logged it shows an honest empty label instead of a zero goal.
 * @param props Habit identity, current amount, add/clear handlers, disabled flag.
 * @returns A list row with an accessible liters stepper and honest amount.
 * @example
 * <HydrationHabitRow habit={habit} amount="1.5" onAdd={add} onClear={clear} />
 */
export function HydrationHabitRow({
  habit,
  amount,
  onAdd,
  onClear,
  disabled = false,
}: HydrationHabitRowProps): JSX.Element {
  const hasAmount = amount !== null;

  const handleAdd = (): void => {
    if (isQuantitativeHabitKey(habit.id)) {
      onAdd(habit.id);
    }
  };

  const handleClear = (): void => {
    if (isQuantitativeHabitKey(habit.id)) {
      onClear(habit.id);
    }
  };

  return (
    <li className="flex min-w-0 items-center gap-3 py-2">
      <span
        className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-muted text-brand"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={habit.icon} />
        </svg>
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{habit.name}</span>
        <span className="block truncate text-xs text-ink-muted">
          {hasAmount ? COPY.registered : COPY.empty}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-1.5">
        {hasAmount ? (
          <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-ink ring-1 ring-line">
            <MetricValue
              metric={metric(formatHydrationLiters(amount), 'user_input')}
              label={habit.name}
            />
          </span>
        ) : null}
        {hasAmount ? (
          <button
            type="button"
            aria-label={`${COPY.reset} ${habit.name}`}
            disabled={disabled}
            onClick={handleClear}
            className={cn(
              'grid size-11 place-items-center rounded-lg border border-line text-ink-muted transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              disabled ? 'cursor-not-allowed opacity-70' : 'hover:bg-canvas',
            )}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v3h3" />
            </svg>
          </button>
        ) : null}

        <button
          type="button"
          aria-label={`${COPY.add} ${COPY.step} ${habit.name}`}
          disabled={disabled}
          onClick={handleAdd}
          className={cn(
            'flex min-h-11 items-center gap-1 rounded-lg bg-brand px-3 text-sm font-medium text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
            disabled ? 'cursor-not-allowed opacity-70' : 'hover:bg-brand/90',
          )}
        >
          <span aria-hidden="true">+ {COPY.step}</span>
        </button>
      </span>
    </li>
  );
}
