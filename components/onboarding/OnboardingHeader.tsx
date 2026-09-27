'use client';

import { ONBOARDING_COPY, ONBOARDING_TEST_IDS } from '@/lib/copy/onboarding';

import { ProgressBar } from './ProgressBar';
import { StepChips } from './StepChips';

const TOTAL_STEPS = ONBOARDING_COPY.tabs.length;

type OnboardingHeaderProps = {
  /** Zero-based index of the active step (0..3). */
  activeIndex: number;
  /** Navigates one step back, or exits to home when on the first step. */
  onBack: () => void;
  /** Skips the whole onboarding flow. */
  onSkip: () => void;
  /** Prevents navigation while an account action is being saved. */
  disableNavigation?: boolean;
};

/**
 * Sticky wizard header: step tabs, back/skip controls, step counter and a segmented progress bar.
 * @param props Active step index and the back/skip callbacks.
 * @returns The onboarding header region.
 * @example <OnboardingHeader activeIndex={0} onBack={goBack} onSkip={skip} />
 */
export function OnboardingHeader({
  activeIndex,
  onBack,
  onSkip,
  disableNavigation = false,
}: OnboardingHeaderProps) {
  return (
    <header
      className="space-y-4 border-b border-line bg-canvas/95 px-4 pb-4 pt-3 backdrop-blur"
      data-testid={ONBOARDING_TEST_IDS.header}
    >
      <StepChips activeIndex={activeIndex} steps={ONBOARDING_COPY.tabs} />

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-1 font-medium text-ink-muted hover:text-ink"
          onClick={onBack}
          disabled={disableNavigation}
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
          disabled={disableNavigation}
          data-testid={ONBOARDING_TEST_IDS.skip}
        >
          {ONBOARDING_COPY.header.skip}
        </button>
      </div>

      <ProgressBar activeIndex={activeIndex} totalSteps={TOTAL_STEPS} />
    </header>
  );
}
