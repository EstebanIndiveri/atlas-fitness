import { cn } from '@/lib/ui/cn';
import type { CoachAdaptStep } from '@/hooks/useCoachAdapt';

const STEPS: ReadonlyArray<{ key: CoachAdaptStep; label: string }> = [
  { key: 'motivo', label: '1. Motivo' },
  { key: 'comparacion', label: '2. Comparación' },
  { key: 'confirmado', label: '3. Confirmado' },
];

/**
 * Shows the three Coach adaptation steps with an accessible current marker.
 *
 * @param props.current Current state-machine step.
 * @returns Ordered adaptation progress indicator.
 * @example
 * <AdaptStepIndicator current="motivo" />
 */
export function AdaptStepIndicator({ current }: { current: CoachAdaptStep }) {
  return (
    <ol aria-label="Progreso de adaptación" className="grid grid-cols-3 gap-2 text-xs" role="list">
      {STEPS.map((step) => {
        const selected = step.key === current;
        return (
          <li key={step.key}>
            <span
              aria-current={selected ? 'step' : undefined}
              className={cn(
                'block rounded-full px-2 py-2 text-center font-semibold ring-1 ring-line',
                selected ? 'bg-brand text-brand-foreground ring-brand' : 'bg-surface text-ink-muted',
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
