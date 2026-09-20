import { afterEach, describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

import { ONBOARDING_COPY, ONBOARDING_TEST_IDS } from '@/lib/copy/onboarding';
import { markOnboardingDone } from '@/lib/onboarding/state';
import { OnboardingWelcome } from './OnboardingWelcome';

describe('OnboardingWelcome', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('renders the first step and advances through the onboarding copy', () => {
    render(<OnboardingWelcome />);

    expect(screen.getByRole('region', { name: ONBOARDING_COPY.title })).toBeTruthy();
    expect(screen.getByText(ONBOARDING_COPY.steps[0].title)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: ONBOARDING_COPY.actions.next }));
    expect(screen.getByText(ONBOARDING_COPY.steps[1].title)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: ONBOARDING_COPY.actions.next }));
    expect(screen.getByText(ONBOARDING_COPY.steps[2].title)).toBeTruthy();
    expect(screen.getByRole('button', { name: ONBOARDING_COPY.actions.start })).toBeTruthy();
  });

  it('persists completion and stays hidden after remount', () => {
    const { rerender } = render(<OnboardingWelcome />);

    fireEvent.click(screen.getByRole('button', { name: ONBOARDING_COPY.actions.skip }));

    expect(screen.queryByTestId(ONBOARDING_TEST_IDS.card)).toBeNull();
    rerender(<OnboardingWelcome />);
    expect(screen.queryByTestId(ONBOARDING_TEST_IDS.card)).toBeNull();
  });

  it('does not render when onboarding was already completed', () => {
    markOnboardingDone();

    render(<OnboardingWelcome />);

    expect(screen.queryByTestId(ONBOARDING_TEST_IDS.card)).toBeNull();
  });
});
