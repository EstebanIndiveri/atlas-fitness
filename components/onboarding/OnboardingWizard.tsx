'use client';

import { useCallback, useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import {
  ONBOARDING_COPY,
  ONBOARDING_TEST_IDS,
  type OnboardingOption,
  type OnboardingSelectableStep,
} from '@/lib/copy/onboarding';
import type { OnboardingAnswers } from '@/lib/onboarding/state';
import { cn } from '@/lib/ui/cn';

import { OnboardingHeader } from './OnboardingHeader';

const SELECTABLE_STEPS = ONBOARDING_COPY.steps as readonly OnboardingSelectableStep[];
const PROPOSAL_INDEX = SELECTABLE_STEPS.length;
const EMPTY_ANSWERS: OnboardingAnswers = { goal: null, pace: null, equipment: null };

type OnboardingWizardProps = {
  /** Called with the collected answers when the user starts (finishes the wizard). */
  onFinish: (answers: OnboardingAnswers) => void;
  /** Called when the user skips onboarding or backs out of the first step. */
  onSkip: () => void;
};

function optionTitle(step: OnboardingSelectableStep, optionId: string | null): string {
  if (optionId === null) {
    return ONBOARDING_COPY.proposal.emptyValue;
  }
  return step.options.find((option) => option.id === optionId)?.title
    ?? ONBOARDING_COPY.proposal.emptyValue;
}

function OptionCard({
  option,
  selected,
  onSelect,
}: {
  option: OnboardingOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      data-testid={ONBOARDING_TEST_IDS.option}
      className={cn(
        'flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition',
        selected
          ? 'border-brand bg-surface shadow-card'
          : 'border-line bg-surface/80 hover:border-brand/40',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-ink">{option.title}</span>
        <span className="mt-1 block text-sm leading-6 text-ink-muted">{option.description}</span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border',
          selected ? 'border-brand bg-brand text-brand-foreground' : 'border-line',
        )}
      >
        {selected ? '✓' : ''}
      </span>
    </button>
  );
}

function ProposalSummary({ answers }: { answers: OnboardingAnswers }) {
  const [goalStep, paceStep, equipmentStep] = SELECTABLE_STEPS;
  const rows = [
    { label: ONBOARDING_COPY.proposal.goalLabel, value: optionTitle(goalStep, answers.goal) },
    { label: ONBOARDING_COPY.proposal.paceLabel, value: optionTitle(paceStep, answers.pace) },
    {
      label: ONBOARDING_COPY.proposal.equipmentLabel,
      value: optionTitle(equipmentStep, answers.equipment),
    },
  ];

  return (
    <div className="space-y-4">
      <span className="inline-flex items-center rounded-full bg-brand-muted px-3 py-1 text-xs font-semibold text-brand">
        {ONBOARDING_COPY.proposal.badge}
      </span>
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">
          {ONBOARDING_COPY.proposal.title}
        </h1>
        <p className="mt-2 text-base leading-7 text-ink-muted">
          {ONBOARDING_COPY.proposal.subtitle}
        </p>
      </div>
      <dl className="divide-y divide-line rounded-2xl border border-line bg-surface/80">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 p-4">
            <dt className="text-sm font-medium text-ink-muted">{row.label}</dt>
            <dd className="text-right text-base font-semibold text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
      <div className="rounded-2xl bg-brand-muted p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
          {ONBOARDING_COPY.proposal.goldenPathLabel}
        </p>
        <p className="mt-2 text-base leading-7 text-ink">{ONBOARDING_COPY.proposal.goldenPath}</p>
      </div>
    </div>
  );
}

function SelectableStep({
  step,
  selectedId,
  onSelect,
}: {
  step: OnboardingSelectableStep;
  selectedId: string | null;
  onSelect: (optionId: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <span className="inline-flex items-center rounded-full bg-brand-muted px-3 py-1 text-xs font-semibold text-brand">
          {step.badge}
        </span>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">{step.title}</h1>
        <p className="text-base leading-7 text-ink-muted">{step.subtitle}</p>
      </div>
      <div className="space-y-3" role="radiogroup" aria-label={step.title}>
        {step.options.map((option) => (
          <OptionCard
            key={option.id}
            option={option}
            selected={selectedId === option.id}
            onSelect={() => onSelect(option.id)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * First-run onboarding wizard: goal, pace, equipment selection and a plan proposal.
 * @param props Finish and skip callbacks.
 * @returns The full-screen onboarding flow.
 * @example <OnboardingWizard onFinish={save} onSkip={skip} />
 */
export function OnboardingWizard({ onFinish, onSkip }: OnboardingWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>(EMPTY_ANSWERS);

  const currentStep = stepIndex < PROPOSAL_INDEX ? SELECTABLE_STEPS[stepIndex] : null;
  const currentSelection = currentStep ? answers[currentStep.id] : null;
  const isProposal = stepIndex === PROPOSAL_INDEX;
  const canContinue = isProposal || currentSelection !== null;

  const handleSelect = useCallback(
    (optionId: string) => {
      if (!currentStep) {
        return;
      }
      setAnswers((prev) => ({ ...prev, [currentStep.id]: optionId }));
    },
    [currentStep],
  );

  const handleBack = useCallback(() => {
    setStepIndex((index) => {
      if (index === 0) {
        onSkip();
        return index;
      }
      return index - 1;
    });
  }, [onSkip]);

  const handlePrimary = useCallback(() => {
    if (isProposal) {
      onFinish(answers);
      return;
    }
    setStepIndex((index) => Math.min(index + 1, PROPOSAL_INDEX));
  }, [answers, isProposal, onFinish]);

  const primaryLabel = useMemo(
    () => (isProposal ? ONBOARDING_COPY.actions.start : ONBOARDING_COPY.actions.continue),
    [isProposal],
  );

  return (
    <section
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-canvas"
      data-testid={ONBOARDING_TEST_IDS.wizard}
    >
      <OnboardingHeader activeIndex={stepIndex} onBack={handleBack} onSkip={onSkip} />

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {currentStep ? (
          <SelectableStep
            step={currentStep}
            selectedId={currentSelection}
            onSelect={handleSelect}
          />
        ) : (
          <ProposalSummary answers={answers} />
        )}
      </div>

      <div className="sticky bottom-0 border-t border-line bg-surface/95 px-4 py-4 backdrop-blur">
        <Button
          className="min-h-12 w-full text-base"
          onClick={handlePrimary}
          disabled={!canContinue}
          data-testid={ONBOARDING_TEST_IDS.continue}
        >
          {primaryLabel}
          <span aria-hidden="true"> →</span>
        </Button>
      </div>
    </section>
  );
}
