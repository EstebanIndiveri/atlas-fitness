'use client';

import { useRef } from 'react';

import { cn } from '@/lib/ui/cn';

export interface SegmentedControlOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  options: ReadonlyArray<SegmentedControlOption>;
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * Accessible segmented control using radio semantics.
 *
 * @param props Options, selected value, change handler and accessible label.
 * @returns A keyboard-navigable segmented control.
 * @example
 * <SegmentedControl options={options} value="month" onChange={setPeriod} ariaLabel="Rango" />
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps) {
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const moveSelection = (direction: 1 | -1): void => {
    if (options.length === 0) {
      return;
    }
    const nextIndex = (selectedIndex + direction + options.length) % options.length;
    onChange(options[nextIndex].value);
    buttonRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('grid gap-1 rounded-lg bg-canvas p-1 ring-1 ring-line', className)}
      style={{ gridTemplateColumns: `repeat(${Math.max(1, options.length)}, minmax(0, 1fr))` }}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              buttonRefs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault();
                moveSelection(1);
              }
              if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault();
                moveSelection(-1);
              }
            }}
            className={cn(
              'rounded-md px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              selected
                ? 'bg-surface font-semibold text-ink shadow-sm ring-1 ring-line'
                : 'font-medium text-ink-muted hover:bg-surface/70 hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
