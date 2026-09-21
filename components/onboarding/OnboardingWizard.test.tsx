/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

import { ONBOARDING_COPY, ONBOARDING_TEST_IDS } from '@/lib/copy/onboarding';
import type { OnboardingAnswers } from '@/lib/onboarding/state';
import { OnboardingWizard } from './OnboardingWizard';

const [goalStep, paceStep, equipmentStep] = ONBOARDING_COPY.steps;

function selectFirstOptionAndContinue(): void {
  const options = screen.getAllByTestId(ONBOARDING_TEST_IDS.option);
  fireEvent.click(options[0]);
  fireEvent.click(screen.getByTestId(ONBOARDING_TEST_IDS.continue));
}

describe('OnboardingWizard', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the goal step with its options and a disabled continue until a choice is made', () => {
    render(<OnboardingWizard onFinish={jest.fn()} onSkip={jest.fn()} />);

    expect(screen.getByRole('heading', { level: 1, name: goalStep.title })).toBeTruthy();
    expect(screen.getByText(goalStep.badge)).toBeTruthy();
    expect(screen.getByText(ONBOARDING_COPY.header.stepLabel(1, 4))).toBeTruthy();
    expect(screen.getAllByTestId(ONBOARDING_TEST_IDS.option)).toHaveLength(goalStep.options.length);

    const continueButton = screen.getByTestId(ONBOARDING_TEST_IDS.continue);
    expect(continueButton).toHaveProperty('disabled', true);

    fireEvent.click(screen.getAllByTestId(ONBOARDING_TEST_IDS.option)[0]);
    expect(screen.getByTestId(ONBOARDING_TEST_IDS.continue)).toHaveProperty('disabled', false);
  });

  it('advances through every step and finishes with the selected answers', () => {
    const onFinish = jest.fn<(answers: OnboardingAnswers) => void>();
    render(<OnboardingWizard onFinish={onFinish} onSkip={jest.fn()} />);

    expect(screen.getByRole('heading', { level: 1, name: goalStep.title })).toBeTruthy();
    selectFirstOptionAndContinue();

    expect(screen.getByRole('heading', { level: 1, name: paceStep.title })).toBeTruthy();
    expect(screen.getByText(ONBOARDING_COPY.header.stepLabel(2, 4))).toBeTruthy();
    selectFirstOptionAndContinue();

    expect(screen.getByRole('heading', { level: 1, name: equipmentStep.title })).toBeTruthy();
    selectFirstOptionAndContinue();

    expect(
      screen.getByRole('heading', { level: 1, name: ONBOARDING_COPY.proposal.title }),
    ).toBeTruthy();
    expect(screen.getByText(goalStep.options[0].title)).toBeTruthy();
    expect(screen.getByText(paceStep.options[0].title)).toBeTruthy();
    expect(screen.getByText(equipmentStep.options[0].title)).toBeTruthy();

    fireEvent.click(screen.getByTestId(ONBOARDING_TEST_IDS.continue));
    expect(onFinish).toHaveBeenCalledWith({
      goal: goalStep.options[0].id,
      pace: paceStep.options[0].id,
      equipment: equipmentStep.options[0].id,
    });
  });

  it('lets the user go back to a previous step keeping the selection', () => {
    render(<OnboardingWizard onFinish={jest.fn()} onSkip={jest.fn()} />);

    selectFirstOptionAndContinue();
    expect(screen.getByRole('heading', { level: 1, name: paceStep.title })).toBeTruthy();

    fireEvent.click(screen.getByTestId(ONBOARDING_TEST_IDS.back));
    expect(screen.getByRole('heading', { level: 1, name: goalStep.title })).toBeTruthy();
    expect(screen.getByTestId(ONBOARDING_TEST_IDS.continue)).toHaveProperty('disabled', false);
  });

  it('calls onSkip when the skip control is used', () => {
    const onSkip = jest.fn();
    render(<OnboardingWizard onFinish={jest.fn()} onSkip={onSkip} />);

    fireEvent.click(screen.getByTestId(ONBOARDING_TEST_IDS.skip));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('exits via onSkip when backing out of the first step', () => {
    const onSkip = jest.fn();
    render(<OnboardingWizard onFinish={jest.fn()} onSkip={onSkip} />);

    fireEvent.click(screen.getByTestId(ONBOARDING_TEST_IDS.back));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
