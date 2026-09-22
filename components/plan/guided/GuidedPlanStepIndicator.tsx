import { cn } from '@/lib/ui/cn';
import type { GuidedPlanStep } from './useGuidedPlan';

const STEPS: readonly { id: GuidedPlanStep; label: string }[] = [
  { id: 'brief', label: 'Brief' },
  { id: 'review', label: 'Revisión' },
  { id: 'success', label: 'Listo' },
];

function stepRank(step: GuidedPlanStep): number {
  if (step === 'saving') return 1;
  return Math.max(0, STEPS.findIndex((item) => item.id === step));
}

export function GuidedPlanStepIndicator({ current }: { current: GuidedPlanStep }) {
  const activeRank = stepRank(current);
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Progreso del plan guiado">
      {STEPS.map((step, index) => (
        <li
          key={step.id}
          className={cn(
            'rounded-full border px-3 py-2 text-center text-xs font-semibold',
            index <= activeRank ? 'border-brand bg-brand-muted text-brand' : 'border-line text-ink-muted',
          )}
        >
          {step.label}
        </li>
      ))}
    </ol>
  );
}
