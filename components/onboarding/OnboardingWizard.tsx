'use client';

import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { LegacyPreferencesImport } from '@/components/onboarding/LegacyPreferencesImport';
import {
  ONBOARDING_COPY,
  ONBOARDING_TEST_IDS,
  type OnboardingSelectableStep,
} from '@/lib/copy/onboarding';
import type { OnboardingAnswers } from '@/lib/onboarding/state';

import { OnboardingHeader } from './OnboardingHeader';
import { OptionCard } from './OptionCard';

const SELECTABLE_STEPS = ONBOARDING_COPY.steps as readonly OnboardingSelectableStep[];
const PROPOSAL_INDEX = SELECTABLE_STEPS.length;
const EMPTY_ANSWERS: OnboardingAnswers = { goal: null, pace: null, equipment: null };

type OnboardingWizardProps = {
  /** Called with the collected answers when the user starts (finishes the wizard). */
  onFinish: (answers: OnboardingAnswers) => void | Promise<void>;
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
    <div className="space-y-5">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-muted px-3 py-1 text-xs font-semibold text-brand">
        <span aria-hidden="true">◎</span>
        <span>{ONBOARDING_COPY.proposal.badge}</span>
      </span>
      <div>
        <h1 className="font-serif text-4xl font-semibold leading-[0.95] tracking-[-0.04em] text-ink">
          {ONBOARDING_COPY.proposal.title}
        </h1>
        <p className="mt-3 text-base leading-7 text-ink-muted">
          {ONBOARDING_COPY.proposal.subtitle}
        </p>
      </div>
      <dl className="divide-y divide-line rounded-3xl border border-line bg-surface shadow-[0_1px_0_rgb(11_18_32/0.04)]">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 p-4">
            <dt className="text-sm font-medium text-ink-muted">{row.label}</dt>
            <dd className="text-right text-base font-semibold text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
      <div className="rounded-3xl bg-brand-muted p-4">
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
  const activeOptionIndex = Math.max(
    0,
    step.options.findIndex((option) => option.id === selectedId),
  );

  const handleOptionKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, optionIndex: number) => {
      const lastIndex = step.options.length - 1;
      const nextIndexByKey: Record<string, number> = {
        ArrowDown: optionIndex === lastIndex ? 0 : optionIndex + 1,
        ArrowRight: optionIndex === lastIndex ? 0 : optionIndex + 1,
        ArrowUp: optionIndex === 0 ? lastIndex : optionIndex - 1,
        ArrowLeft: optionIndex === 0 ? lastIndex : optionIndex - 1,
        Home: 0,
        End: lastIndex,
      };
      const nextIndex = nextIndexByKey[event.key];

      if (nextIndex === undefined) {
        return;
      }

      event.preventDefault();
      const nextOption = step.options[nextIndex];

      if (!nextOption) {
        return;
      }

      onSelect(nextOption.id);
      const radioGroup = event.currentTarget.closest('[role="radiogroup"]');
      const radios = Array.from(
        radioGroup?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [],
      );
      radios[nextIndex]?.focus();
    },
    [onSelect, step.options],
  );

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-muted px-3 py-1 text-xs font-semibold text-brand">
          <span aria-hidden="true">◎</span>
          <span>{step.badge}</span>
        </span>
        <h1 className="font-serif text-4xl font-semibold leading-[0.95] tracking-[-0.04em] text-ink">
          {step.title}
        </h1>
        <p className="text-base leading-7 text-ink-muted">{step.subtitle}</p>
      </div>
      <div className="space-y-3" role="radiogroup" aria-label={step.title}>
        {step.options.map((option, index) => (
          <OptionCard
            key={option.id}
            option={option}
            selected={selectedId === option.id}
            onSelect={() => onSelect(option.id)}
            onKeyDown={(event) => handleOptionKeyDown(event, index)}
            tabIndex={index === activeOptionIndex ? 0 : -1}
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
  const [isFinishing, setIsFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  const currentStep = stepIndex < PROPOSAL_INDEX ? SELECTABLE_STEPS[stepIndex] : null;
  const currentSelection = currentStep ? answers[currentStep.id] : null;
  const isProposal = stepIndex === PROPOSAL_INDEX;
  const canContinue = isProposal || currentSelection !== null;

  const handleSelect = useCallback(
    (optionId: string) => {
      if (!currentStep) {
        return;
      }
      setFinishError(null);
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

  const handlePrimary = useCallback(async () => {
    if (isProposal) {
      if (isFinishing) {
        return;
      }
      setIsFinishing(true);
      setFinishError(null);
      try {
        await onFinish(answers);
      } catch (error) {
        setFinishError(
          error instanceof Error ? error.message : ONBOARDING_COPY.sync.finishFailure,
        );
      } finally {
        setIsFinishing(false);
      }
      return;
    }
    setStepIndex((index) => Math.min(index + 1, PROPOSAL_INDEX));
  }, [answers, isFinishing, isProposal, onFinish]);

  const primaryLabel = useMemo(
    () =>
      isProposal
        ? finishError
          ? ONBOARDING_COPY.sync.retry
          : isFinishing
            ? 'Guardando…'
            : ONBOARDING_COPY.actions.start
        : ONBOARDING_COPY.actions.continue,
    [finishError, isFinishing, isProposal],
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
          <div className="space-y-5">
            <ProposalSummary answers={answers} />
            <LegacyPreferencesImport />
          </div>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-line bg-surface/95 px-4 py-4 backdrop-blur">
        {finishError ? (
          <p role="alert" className="mb-3 text-sm text-danger">
            {finishError}
          </p>
        ) : null}
        <Button
          className="min-h-12 w-full rounded-full bg-ink text-base text-surface hover:bg-ink/90"
          onClick={handlePrimary}
          disabled={!canContinue || isFinishing}
          data-testid={ONBOARDING_TEST_IDS.continue}
        >
          {primaryLabel}
          <span aria-hidden="true"> →</span>
        </Button>
      </div>
    </section>
  );
}
