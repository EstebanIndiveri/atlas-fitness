import { cn } from '@/lib/ui/cn';

type ProgressBarProps = {
  readonly activeIndex: number;
  readonly totalSteps: number;
};

/**
 * Four-segment onboarding progress indicator.
 * @param props Active zero-based step and total segment count.
 * @returns An accessible segmented progress bar.
 */
export function ProgressBar({ activeIndex, totalSteps }: ProgressBarProps) {
  const currentStep = activeIndex + 1;

  return (
    <div
      role="progressbar"
      aria-label="Progreso del onboarding"
      aria-valuemin={1}
      aria-valuemax={totalSteps}
      aria-valuenow={currentStep}
      className="flex gap-1.5"
      data-testid="onboarding-progress"
    >
      {Array.from({ length: totalSteps }, (_, index) => (
        <span
          key={index}
          data-progress-segment="true"
          className={cn(
            'h-1.5 flex-1 rounded-full transition-colors',
            index <= activeIndex ? 'bg-brand' : 'bg-line',
          )}
        />
      ))}
    </div>
  );
}
