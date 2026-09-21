'use client';

import { cn } from '@/lib/ui/cn';
import { ONBOARDING_COPY, ONBOARDING_TEST_IDS } from '@/lib/copy/onboarding';

const TOTAL_STEPS = ONBOARDING_COPY.tabs.length;

type OnboardingHeaderProps = {
  /** Zero-based index of the active step (0..3). */
  activeIndex: number;
  /** Navigates one step back, or exits to home when on the first step. */
  onBack: () => void;
  /** Skips the whole onboarding flow. */
  onSkip: () => void;
};

/**
 * Sticky wizard header: step tabs, back/skip controls, step counter and a segmented progress bar.
 * @param props Active step index and the back/skip callbacks.
 * @returns The onboarding header region.
 * @example <OnboardingHeader activeIndex={0} onBack={goBack} onSkip={skip} />
 */
export function OnboardingHeader({ activeIndex, onBack, onSkip }: OnboardingHeaderProps) {
  return (
    <header
      className="space-y-4 border-b border-line bg-surface/95 px-4 pb-4 pt-3 backdrop-blur"
      data-testid={ONBOARDING_TEST_IDS.header}
    >
      <ul className="flex gap-2 overflow-x-auto" aria-hidden="true">
        {ONBOARDING_COPY.tabs.map((tab, index) => (
          <li
            key={tab.id}
            className={cn(
              'whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold',
              index === activeIndex
                ? 'bg-brand text-brand-foreground'
                : index < activeIndex
                  ? 'bg-brand-muted text-brand'
                  : 'bg-canvas text-ink-muted',
            )}
          >
            {index + 1}. {tab.label}
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-1 font-medium text-ink-muted hover:text-ink"
          onClick={onBack}
          data-testid={ONBOARDING_TEST_IDS.back}
        >
          <span aria-hidden="true">←</span>
          {ONBOARDING_COPY.header.home}
        </button>
        <span className="font-medium text-ink-muted">
          {ONBOARDING_COPY.header.stepLabel(activeIndex + 1, TOTAL_STEPS)}
        </span>
        <button
          type="button"
          className="inline-flex min-h-11 items-center font-medium text-ink-muted hover:text-ink"
          onClick={onSkip}
          data-testid={ONBOARDING_TEST_IDS.skip}
        >
          {ONBOARDING_COPY.header.skip}
        </button>
      </div>

      <div className="flex gap-1.5" aria-hidden="true">
        {ONBOARDING_COPY.tabs.map((tab, index) => (
          <span
            key={tab.id}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              index <= activeIndex ? 'bg-brand' : 'bg-line',
            )}
          />
        ))}
      </div>
    </header>
  );
}
