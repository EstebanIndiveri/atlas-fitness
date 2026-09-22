'use client';

import { Button } from '@/components/ui/Button';
import { isValidWeightKg } from '@/lib/format/weight';

type SessionCompleteSetBarProps = {
  activeSet: number;
  weight: string;
  reps: string;
  busy: boolean;
  nextExerciseName?: string | null;
  onCompleteSet: () => void;
};

function hasValidReps(value: string): boolean {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0;
}

/**
 * Fixed guided-session CTA that stays clear of the active set steppers.
 *
 * @param props Active set metadata plus completion handler owned by the guided-session hook.
 * @returns Mobile-first fixed bottom action bar with safe-area and app-nav clearance.
 * @example
 * <SessionCompleteSetBar activeSet={3} weight="75" reps="8" busy={false} onCompleteSet={() => {}} />
 */
export function SessionCompleteSetBar({
  activeSet,
  weight,
  reps,
  busy,
  nextExerciseName,
  onCompleteSet,
}: SessionCompleteSetBarProps) {
  const completeLabel = `COMPLETAR SERIE ${activeSet}`;
  const completeAriaLabel = `Completar serie ${activeSet}`;

  return (
    <div
      className="fixed inset-x-0 bottom-app-cta z-30 border-t border-line bg-canvas/95 px-4 py-3 shadow-card backdrop-blur md:sticky md:bottom-4 md:mx-auto md:max-w-4xl md:rounded-2xl md:border"
      data-testid="complete-set-bar"
    >
      <Button
        size="lg"
        className="min-h-12 rounded-xl bg-brand text-base font-black tracking-[0.02em] text-brand-foreground hover:bg-brand-hover disabled:bg-brand/60 disabled:text-brand-foreground disabled:opacity-100"
        onClick={onCompleteSet}
        disabled={busy || !isValidWeightKg(weight.trim()) || !hasValidReps(reps)}
        data-testid="complete-set-button"
        aria-label={completeAriaLabel}
      >
        <svg
          className="mr-2 size-5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
          data-testid="complete-set-icon"
        >
          <circle cx="12" cy="12" r="8.5" />
          <path d="m8.5 12 2.25 2.25L15.75 9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {completeLabel}
      </Button>
      {nextExerciseName ? (
        <p className="mt-2 text-center text-xs font-medium text-ink-muted">
          Siguiente: {nextExerciseName}
        </p>
      ) : null}
    </div>
  );
}
