import type { KeyboardEventHandler } from 'react';

import {
  ONBOARDING_TEST_IDS,
  type OnboardingOption,
} from '@/lib/copy/onboarding';
import { cn } from '@/lib/ui/cn';

const OPTION_ICON: Record<string, string> = {
  muscle: '◐',
  strength: '◆',
  fitness: '◎',
  consistency: '✦',
  wellbeing: '☼',
  'days-2': 'Ⅱ',
  'days-3': 'Ⅲ',
  'days-4': 'Ⅳ',
  'days-5': 'Ⅴ',
  gym: '▣',
  dumbbells: '◧',
  bodyweight: '○',
  bands: '⌁',
};

type OptionCardProps = {
  readonly option: OnboardingOption;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly onKeyDown: KeyboardEventHandler<HTMLButtonElement>;
  readonly tabIndex: number;
};

/**
 * Selectable onboarding option with radio semantics.
 * @param props Option copy, selected state and select handler.
 * @returns A tappable card for one wizard choice.
 */
export function OptionCard({
  option,
  selected,
  onKeyDown,
  onSelect,
  tabIndex,
}: OptionCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      tabIndex={tabIndex}
      data-testid={ONBOARDING_TEST_IDS.option}
      className={cn(
        'flex w-full items-start gap-3 rounded-3xl border bg-surface p-4 text-left shadow-[0_1px_0_rgb(11_18_32/0.04)] transition',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        selected
          ? 'border-brand shadow-card'
          : 'border-line hover:border-brand/50 hover:bg-surface/90',
      )}
    >
      <span
        aria-hidden="true"
        data-option-icon="true"
        className={cn(
          'grid h-10 w-10 shrink-0 place-items-center rounded-full text-base font-semibold',
          selected ? 'bg-brand text-brand-foreground' : 'bg-brand-muted text-brand',
        )}
      >
        {OPTION_ICON[option.id] ?? '◎'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold leading-5 text-ink">{option.title}</span>
        <span className="mt-1.5 block text-sm leading-6 text-ink-muted">
          {option.description}
        </span>
      </span>
      <span
        aria-hidden="true"
        data-option-check="true"
        className={cn(
          'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-bold',
          selected ? 'border-brand bg-brand text-brand-foreground' : 'border-line text-transparent',
        )}
      >
        {selected ? '✓' : ''}
      </span>
    </button>
  );
}
