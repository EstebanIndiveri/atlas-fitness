/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

import { ONBOARDING_COPY, ONBOARDING_TEST_IDS } from '@/lib/copy/onboarding';
import type { OnboardingAnswers } from '@/lib/onboarding/state';
import { OnboardingWizard } from './OnboardingWizard';

const [goalStep, paceStep, equipmentStep] = ONBOARDING_COPY.steps;
const noopFinish: (answers: OnboardingAnswers) => void = () => undefined;

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
    render(<OnboardingWizard onFinish={noopFinish} onSkip={jest.fn()} />);

    expect(screen.getByRole('heading', { level: 1, name: goalStep.title })).toBeTruthy();
    expect(screen.getByText(goalStep.badge)).toBeTruthy();
    expect(screen.getByText(ONBOARDING_COPY.header.stepLabel(1, 4))).toBeTruthy();
    expect(screen.getAllByTestId(ONBOARDING_TEST_IDS.option)).toHaveLength(goalStep.options.length);

    const continueButton = screen.getByTestId(ONBOARDING_TEST_IDS.continue);
    expect(continueButton).toHaveProperty('disabled', true);

    fireEvent.click(screen.getAllByTestId(ONBOARDING_TEST_IDS.option)[0]);
    expect(screen.getByTestId(ONBOARDING_TEST_IDS.continue)).toHaveProperty('disabled', false);
  });

  it('renders the Figma step chrome with a dark active chip and segmented progress', () => {
    render(<OnboardingWizard onFinish={noopFinish} onSkip={jest.fn()} />);

    const activeChip = screen.getByRole('listitem', { name: '1. Objetivo' });
    expect(activeChip.className).toContain('bg-ink');
    expect(screen.getByRole('listitem', { name: '2. Ritmo' }).className).toContain('bg-surface');
    expect(
      screen.getByRole('progressbar', { name: 'Progreso del onboarding' }).getAttribute(
        'aria-valuenow',
      ),
    ).toBe('1');

    const progress = screen.getByTestId('onboarding-progress');
    const segments = Array.from(progress.querySelectorAll('[data-progress-segment="true"]'));
    expect(segments).toHaveLength(4);
    expect(segments[0]?.className).toContain('bg-brand');
    expect(segments[1]?.className).toContain('bg-line');

    selectFirstOptionAndContinue();

    expect(screen.getByRole('listitem', { name: '2. Ritmo' }).className).toContain('bg-ink');
    const updatedSegments = Array.from(progress.querySelectorAll('[data-progress-segment="true"]'));
    expect(updatedSegments[1]?.className).toContain('bg-brand');
  });

  it('uses selectable option cards with radio semantics, a leading icon, and a checked state', () => {
    render(<OnboardingWizard onFinish={noopFinish} onSkip={jest.fn()} />);

    const radioOptions = screen.getAllByRole('radio');
    expect(radioOptions).toHaveLength(goalStep.options.length);
    expect(radioOptions[0]?.getAttribute('aria-checked')).toBe('false');
    expect(radioOptions[0]?.querySelector('[data-option-icon="true"]')?.textContent).toBeTruthy();

    fireEvent.click(radioOptions[0] as HTMLElement);

    expect(radioOptions[0]?.getAttribute('aria-checked')).toBe('true');
    expect(radioOptions[0]?.className).toContain('border-brand');
    expect(radioOptions[0]?.querySelector('[data-option-check="true"]')?.textContent).toBe('✓');
  });

  it('supports arrow-key selection inside the custom radio group', () => {
    render(<OnboardingWizard onFinish={noopFinish} onSkip={jest.fn()} />);

    const radioOptions = screen.getAllByRole('radio');
    (radioOptions[0] as HTMLElement).focus();
    fireEvent.keyDown(radioOptions[0] as HTMLElement, { key: 'ArrowDown' });

    expect(radioOptions[1]?.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(radioOptions[1]);
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
    render(<OnboardingWizard onFinish={noopFinish} onSkip={jest.fn()} />);

    selectFirstOptionAndContinue();
    expect(screen.getByRole('heading', { level: 1, name: paceStep.title })).toBeTruthy();

    fireEvent.click(screen.getByTestId(ONBOARDING_TEST_IDS.back));
    expect(screen.getByRole('heading', { level: 1, name: goalStep.title })).toBeTruthy();
    expect(screen.getByTestId(ONBOARDING_TEST_IDS.continue)).toHaveProperty('disabled', false);
  });

  it('calls onSkip when the skip control is used', () => {
    const onSkip = jest.fn();
    render(<OnboardingWizard onFinish={noopFinish} onSkip={onSkip} />);

    fireEvent.click(screen.getByTestId(ONBOARDING_TEST_IDS.skip));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('exits via onSkip when backing out of the first step', () => {
    const onSkip = jest.fn();
    render(<OnboardingWizard onFinish={noopFinish} onSkip={onSkip} />);

    fireEvent.click(screen.getByTestId(ONBOARDING_TEST_IDS.back));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
