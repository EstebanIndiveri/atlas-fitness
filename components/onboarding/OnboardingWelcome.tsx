'use client';

import { useCallback, useEffect, useId, useState, useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ONBOARDING_COPY, ONBOARDING_TEST_IDS } from '@/lib/copy/onboarding';
import { isOnboardingDone, markOnboardingDone } from '@/lib/onboarding/state';

const LAST_STEP_INDEX = ONBOARDING_COPY.steps.length - 1;

function subscribeToStorage(): () => void {
  return () => undefined;
}

function shouldShowOnboarding(): boolean {
  return !isOnboardingDone();
}

function shouldHideDuringSsr(): boolean {
  return false;
}

function StepDots({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="flex gap-1.5" aria-hidden="true">
      {ONBOARDING_COPY.steps.map((step, index) => (
        <span
          key={step.title}
          className={
            index === activeIndex
              ? 'h-2 w-6 rounded-full bg-brand'
              : 'h-2 w-2 rounded-full bg-line'
          }
        />
      ))}
    </div>
  );
}

function StepCard({ activeIndex }: { activeIndex: number }) {
  const step = ONBOARDING_COPY.steps[activeIndex];
  const stepNumber = activeIndex + 1;

  return (
    <div
      className="rounded-xl border border-line bg-surface/80 p-4"
      data-testid={ONBOARDING_TEST_IDS.step}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brand-foreground">
          {step.badge}
        </span>
        <span className="text-xs font-medium text-ink-muted">
          {ONBOARDING_COPY.stepLabel(stepNumber, ONBOARDING_COPY.steps.length)}
        </span>
      </div>
      <h3 className="mt-4 text-xl font-semibold leading-tight tracking-[-0.02em] text-ink">
        {step.title}
      </h3>
      <p className="mt-2 text-base leading-7 text-ink-muted">{step.body}</p>
    </div>
  );
}

/**
 * Renders the dismissible first-run onboarding card for the Today screen.
 * @returns Onboarding UI until completion is persisted, otherwise null.
 * @example <OnboardingWelcome />
 */
export function OnboardingWelcome() {
  const headingId = useId();
  const shouldShow = useSyncExternalStore(
    subscribeToStorage,
    shouldShowOnboarding,
    shouldHideDuringSsr,
  );
  const [dismissed, setDismissed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const dismiss = useCallback((): void => {
    markOnboardingDone();
    setDismissed(true);
  }, []);

  const visible = shouldShow && !dismissed;

  const handleNext = useCallback((): void => {
    if (activeIndex >= LAST_STEP_INDEX) {
      dismiss();
      return;
    }
    setActiveIndex((current) => Math.min(current + 1, LAST_STEP_INDEX));
  }, [activeIndex, dismiss]);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        dismiss();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dismiss, visible]);

  if (!visible) {
    return null;
  }

  const primaryLabel =
    activeIndex === LAST_STEP_INDEX
      ? ONBOARDING_COPY.actions.start
      : ONBOARDING_COPY.actions.next;

  return (
    <section aria-labelledby={headingId} data-testid={ONBOARDING_TEST_IDS.card}>
      <Card className="relative overflow-hidden rounded-2xl border border-brand/20 bg-surface p-0 shadow-card">
        <div className="absolute inset-x-0 top-0 h-1 bg-brand" aria-hidden="true" />
        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-brand">
                {ONBOARDING_COPY.eyebrow}
              </p>
              <h2 id={headingId} className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-ink">
                {ONBOARDING_COPY.title}
              </h2>
              <p className="mt-2 text-base leading-7 text-ink-muted">{ONBOARDING_COPY.intro}</p>
            </div>
            <Button variant="ghost" className="min-h-11 px-3" onClick={dismiss}>
              {ONBOARDING_COPY.actions.skip}
            </Button>
          </div>

          <StepCard activeIndex={activeIndex} />

          <div className="rounded-xl bg-brand-muted p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
              {ONBOARDING_COPY.goldenPathLabel}
            </p>
            <p className="mt-2 text-base leading-7 text-ink">{ONBOARDING_COPY.goldenPath}</p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <StepDots activeIndex={activeIndex} />
            <Button className="min-h-11 px-5" onClick={handleNext}>
              {primaryLabel}
            </Button>
          </div>
        </div>
      </Card>
    </section>
  );
}
