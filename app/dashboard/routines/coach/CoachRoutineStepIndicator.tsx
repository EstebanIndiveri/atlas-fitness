import { cn } from '@/lib/ui/cn';

export type CoachRoutineStep = 'brief' | 'proposal' | 'created';

const STEPS: ReadonlyArray<{ key: CoachRoutineStep; label: string }> = [
  { key: 'brief', label: '1. Brief' },
  { key: 'proposal', label: '2. Propuesta' },
  { key: 'created', label: '3. Creada' },
];

/**
 * Shows the Coach Atlas routine creation steps without coupling to the adapt flow state.
 *
 * @param props.current Current creation step.
 * @returns Three-step progress indicator styled like Coach Atlas adapt pills.
 * @example
 * <CoachRoutineStepIndicator current="brief" />
 */
export function CoachRoutineStepIndicator({ current }: { current: CoachRoutineStep }) {
  return (
    <ol aria-label="Progreso de creación" className="grid grid-cols-3 gap-2 text-xs" role="list">
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
