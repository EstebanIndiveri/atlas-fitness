'use client';

import Link from 'next/link';

import { AtlasIcon } from '@/components/ui/AtlasIcon';
import { Button } from '@/components/ui/Button';
import { PROGRESSION_COPY } from '@/lib/copy/exercise-progression';
import { SESSION_COPY } from '@/lib/copy/session';
import { describeRecordedAmount } from '@/lib/format/amount';
import { cordobaDisplayDate } from '@/lib/time/cordoba';
import { MOTION_CELEBRATION_CLASS } from '@/lib/ui/motion';
import { cn } from '@/lib/ui/cn';
import type { ProgressionSourceSet } from '@/types/progression-read';
import type { VerifiedProgressionEvent } from '@/lib/session/close-pr';

export interface VerifiedPrCelebrationProps {
  event: VerifiedProgressionEvent;
  onContinue: () => void;
}

function sourceSetLabel(set: ProgressionSourceSet): string {
  return describeRecordedAmount(
    {
      loadMode: set.semantics.loadMode,
      amountBasis: set.semantics.amountBasis,
      side: set.semantics.side,
      setPurpose: set.semantics.setPurpose,
      repCountBasis: set.semantics.repCountBasis,
    },
    set.weightKg,
  );
}

/**
 * The single bounded MAJOR acknowledgement for a PR verified by the v0.12 read
 * model after a real local open → closed transition (brief §19/E13).
 *
 * It is the only surface allowed to consume `MOTION_CELEBRATION_CLASS`. Meaning
 * is carried by governed text and the reserved verified token; the governed
 * celebration primitive is decoration that reduced motion removes. Ordinary
 * workout completion uses the distinct `complete`/success semantics.
 *
 * @param props The verified event plus the continue callback.
 * @returns An accessible, bounded verified-PR panel.
 * @example
 * <VerifiedPrCelebration event={event} onContinue={() => router.push('/dashboard/today')} />
 */
export function VerifiedPrCelebration({ event, onContinue }: VerifiedPrCelebrationProps) {
  const { progression, sourceSet } = event;
  const { reps, amountBasis, side } = progression.cohort;

  return (
    <section
      data-testid="verified-pr-celebration"
      data-state="new_pr"
      data-icon="verified"
      className={cn(
        'mx-4 mt-4 min-w-0 rounded-panel border border-verified bg-verified-muted p-5',
        MOTION_CELEBRATION_CLASS,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-verified">
          <AtlasIcon name="verified" size="lg" data-testid="verified-pr-icon" />
        </span>
        <div className="min-w-0 space-y-1" role="status" aria-live="polite">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-verified">
            {SESSION_COPY.closePrEyebrow}
          </p>
          <h2 className="text-title font-semibold text-ink" data-testid="verified-pr-title">
            {PROGRESSION_COPY.comparison.new_pr}
          </h2>
          <p className="text-sm leading-relaxed text-ink-muted" data-testid="verified-pr-cohort">
            {PROGRESSION_COPY.cohortLabel}:{' '}
            {PROGRESSION_COPY.cohortSummary(
              reps,
              PROGRESSION_COPY.amountBasisLabel[amountBasis],
              PROGRESSION_COPY.sideLabel[side],
            )}
          </p>
        </div>
      </div>

      <div
        className="mt-4 rounded-xl bg-surface px-3 py-2 ring-1 ring-line"
        data-testid="verified-pr-source"
      >
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          {SESSION_COPY.closePrSourceLabel}
        </p>
        <p className="mt-1 text-sm text-ink">
          {PROGRESSION_COPY.reps(sourceSet.reps)} · {sourceSetLabel(sourceSet)}
        </p>
        <p className="mt-0.5 text-xs text-ink-muted">
          {cordobaDisplayDate(new Date(sourceSet.endedAt))}
        </p>
        <Link
          href={`/dashboard/workout/${sourceSet.workoutId}`}
          className="mt-1 inline-block text-xs font-semibold text-brand hover:underline"
        >
          {PROGRESSION_COPY.sourceWorkoutLink}
        </Link>
      </div>

      <p className="mt-4 flex items-center gap-2 text-sm text-ink-muted">
        <span className="text-success">
          <AtlasIcon name="complete" size="sm" data-testid="verified-pr-complete-icon" />
        </span>
        {SESSION_COPY.closePrSavedLine}
      </p>

      <p className="mt-2 text-sm text-ink" data-testid="verified-pr-encouragement">
        {SESSION_COPY.closePrEncouragement}
      </p>

      <Button
        variant="primary"
        size="lg"
        className="mt-4"
        onClick={onContinue}
        data-testid="verified-pr-continue"
      >
        {SESSION_COPY.closePrContinue}
      </Button>
    </section>
  );
}
