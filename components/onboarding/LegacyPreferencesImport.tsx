'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import {
  ONBOARDING_COPY,
  type OnboardingSelectableStep,
} from '@/lib/copy/onboarding';
import {
  importLegacyPreferencesIfMissing,
} from '@/lib/onboarding/preferences-sync';
import {
  clearOnboardingAnswers,
  readOnboardingAnswers,
  type OnboardingAnswers,
} from '@/lib/onboarding/state';

const SELECTABLE_STEPS = ONBOARDING_COPY.steps as readonly OnboardingSelectableStep[];

function optionTitle(step: OnboardingSelectableStep, optionId: string | null): string {
  if (optionId === null) {
    return ONBOARDING_COPY.proposal.emptyValue;
  }
  return step.options.find((option) => option.id === optionId)?.title
    ?? ONBOARDING_COPY.proposal.emptyValue;
}

function legacyAnswerRows(answers: OnboardingAnswers) {
  const [goalStep, paceStep, equipmentStep] = SELECTABLE_STEPS;
  return [
    { label: ONBOARDING_COPY.proposal.goalLabel, value: optionTitle(goalStep, answers.goal) },
    { label: ONBOARDING_COPY.proposal.paceLabel, value: optionTitle(paceStep, answers.pace) },
    {
      label: ONBOARDING_COPY.proposal.equipmentLabel,
      value: optionTitle(equipmentStep, answers.equipment),
    },
  ];
}

/**
 * Offers an explicit, row-safe import of existing browser-local onboarding answers.
 * @returns The local-answer preview and import confirmation controls.
 * @example <LegacyPreferencesImport />
 */
export function LegacyPreferencesImport() {
  const [answers, setAnswers] = useState<OnboardingAnswers | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  function handleReviewLegacyAnswers(): void {
    setError(null);
    setStatus(null);
    const storedAnswers = readOnboardingAnswers();
    if (!storedAnswers) {
      setAnswers(null);
      setError(ONBOARDING_COPY.sync.importMissing);
      return;
    }
    setAnswers(storedAnswers);
  }

  async function handleConfirmImport(): Promise<void> {
    if (!answers || isImporting) {
      return;
    }

    setIsImporting(true);
    setError(null);
    setStatus(null);
    try {
      const result = await importLegacyPreferencesIfMissing(answers);
      if (result === 'imported') {
        clearOnboardingAnswers();
      }
      setStatus(
        result === 'imported'
          ? ONBOARDING_COPY.sync.importSuccess
          : ONBOARDING_COPY.sync.importAlreadySaved,
      );
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : ONBOARDING_COPY.sync.importFailure,
      );
    } finally {
      setIsImporting(false);
    }
  }

  function handleCancelImport(): void {
    setAnswers(null);
    setError(null);
    setStatus(null);
  }

  return (
    <section className="space-y-3 rounded-3xl border border-line bg-surface p-4">
      <p className="text-sm leading-6 text-ink-muted">{ONBOARDING_COPY.sync.importPrompt}</p>
      {answers ? (
        <>
          <h2 className="text-sm font-semibold text-ink">{ONBOARDING_COPY.sync.importTitle}</h2>
          <dl className="divide-y divide-line rounded-2xl border border-line">
            {legacyAnswerRows(answers).map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 p-3">
                <dt className="text-xs font-medium text-ink-muted">{row.label}</dt>
                <dd className="text-right text-sm font-semibold text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={handleConfirmImport}
              disabled={isImporting}
              data-testid="onboarding-confirm-legacy-import"
            >
              {isImporting ? 'Importando…' : ONBOARDING_COPY.sync.importConfirm}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleCancelImport}
              disabled={isImporting}
            >
              {ONBOARDING_COPY.sync.importCancel}
            </Button>
          </div>
        </>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          onClick={handleReviewLegacyAnswers}
          data-testid="onboarding-import-legacy"
        >
          {ONBOARDING_COPY.sync.importAction}
        </Button>
      )}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      {status ? <p role="status" className="text-sm text-success">{status}</p> : null}
    </section>
  );
}
