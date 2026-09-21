/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

declare const jest: typeof import('@jest/globals').jest;

import { ONBOARDING_COPY, ONBOARDING_TEST_IDS } from '@/lib/copy/onboarding';
import { isOnboardingDone, readOnboardingAnswers } from '@/lib/onboarding/state';

const replace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

import OnboardingPage from './page';

const [goalStep, paceStep, equipmentStep] = ONBOARDING_COPY.steps;

function selectFirstAndContinue(): void {
  fireEvent.click(screen.getAllByTestId(ONBOARDING_TEST_IDS.option)[0]);
  fireEvent.click(screen.getByTestId(ONBOARDING_TEST_IDS.continue));
}

describe('OnboardingPage', () => {
  afterEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  it('persists answers and completion, then routes to Hoy on finish', () => {
    render(<OnboardingPage />);

    selectFirstAndContinue();
    selectFirstAndContinue();
    selectFirstAndContinue();
    fireEvent.click(screen.getByTestId(ONBOARDING_TEST_IDS.continue));

    expect(readOnboardingAnswers()).toEqual({
      goal: goalStep.options[0].id,
      pace: paceStep.options[0].id,
      equipment: equipmentStep.options[0].id,
    });
    expect(isOnboardingDone()).toBe(true);
    expect(replace).toHaveBeenCalledWith('/dashboard/today');
  });

  it('marks completion and routes to Hoy on skip without saving answers', () => {
    render(<OnboardingPage />);

    fireEvent.click(screen.getByTestId(ONBOARDING_TEST_IDS.skip));

    expect(isOnboardingDone()).toBe(true);
    expect(readOnboardingAnswers()).toBeNull();
    expect(replace).toHaveBeenCalledWith('/dashboard/today');
  });
});
