'use client';

import { Button } from '@/components/ui/Button';
import { AtlasIcon } from '@/components/ui/AtlasIcon';
import { isValidWeightKg } from '@/lib/format/weight';

type SessionCompleteSetBarProps = {
  activeSet: number;
  weight: string;
  reps: string;
  busy: boolean;
  nextExerciseName?: string | null;
  /**
   * When provided, overrides the legacy positive-weight gate. The guided player
   * passes the result of the same pure capture validator the API uses, so
   * bodyweight zero and a complete semantic tuple enable the CTA correctly.
   */
  canComplete?: boolean;
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
  canComplete,
  onCompleteSet,
}: SessionCompleteSetBarProps) {
  const completeLabel = `COMPLETAR SERIE ${activeSet}`;
  const completeAriaLabel = `Completar serie ${activeSet}`;
  const enabled = canComplete ?? (isValidWeightKg(weight.trim()) && hasValidReps(reps));

  return (
    <div
      className="fixed inset-x-0 bottom-app-cta z-30 border-t border-line bg-canvas/95 px-4 py-3 shadow-card backdrop-blur md:sticky md:bottom-4 md:mx-auto md:max-w-4xl md:rounded-2xl md:border"
      data-testid="complete-set-bar"
    >
      <Button
        size="lg"
        className="min-h-12 rounded-xl bg-brand text-base font-black tracking-[0.02em] text-brand-foreground hover:bg-brand-hover disabled:bg-brand/60 disabled:text-brand-foreground disabled:opacity-100"
        onClick={onCompleteSet}
        disabled={busy || !enabled}
        data-testid="complete-set-button"
        aria-label={completeAriaLabel}
      >
        <AtlasIcon name="complete" className="mr-2" data-testid="complete-set-icon" />
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
