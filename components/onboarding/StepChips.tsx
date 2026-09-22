import { cn } from '@/lib/ui/cn';

type StepChip = {
  readonly id: string;
  readonly label: string;
};

type StepChipsProps = {
  readonly activeIndex: number;
  readonly steps: readonly StepChip[];
};

/**
 * Horizontal onboarding step chips matching the Figma wizard chrome.
 * @param props Active step and ordered labels.
 * @returns A labelled step-chip list.
 */
export function StepChips({ activeIndex, steps }: StepChipsProps) {
  return (
    <ol className="flex gap-2 overflow-x-auto pb-1" aria-label="Pasos del onboarding">
      {steps.map((step, index) => {
        const label = `${index + 1}. ${step.label}`;
        const active = index === activeIndex;

        return (
          <li
            key={step.id}
            aria-current={active ? 'step' : undefined}
            aria-label={label}
            className={cn(
              'whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold shadow-[0_1px_0_rgb(11_18_32/0.04)]',
              active
                ? 'border-ink bg-ink text-surface'
                : 'border-line bg-surface text-ink-muted',
            )}
          >
            {label}
          </li>
        );
      })}
    </ol>
  );
}
