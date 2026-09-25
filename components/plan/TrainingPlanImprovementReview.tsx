import type { ReactNode } from 'react';

import { buttonClassName } from '@/components/ui/Button';
import type { WeeklyPlanDraft } from '@/lib/ai/weekly-plan-draft';
import { PLAN_DAY_LABELS } from '@/lib/copy/plan';
import type {
  TrainingPlanImprovementAssignment,
  TrainingPlanImprovementProposal,
} from '@/types/training-plan-improvement';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/**
 * Shows the active plan beside its uncommitted improvement proposal.
 *
 * @param props - Proposal, confirmation state, and review actions.
 * @returns A before/proposal comparison with explicit save and cancel controls.
 */
export function TrainingPlanImprovementReview({
  proposal,
  replacementConfirmed,
  applying,
  error,
  onCancel,
  onConfirmationChange,
  onConfirm,
}: {
  proposal: TrainingPlanImprovementProposal;
  replacementConfirmed: boolean;
  applying: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirmationChange: (confirmed: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-5">
      <p className="rounded-xl bg-brand-muted p-4 text-sm leading-6 text-ink">
        {proposal.proposal.source === 'gemini'
          ? 'Propuesta generada por Coach Atlas.'
          : 'Propuesta alternativa generada con las rutinas disponibles.'}{' '}
        Todavía no se guardó ningún cambio.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <WeekColumn
          title="ANTES"
          heading={proposal.currentPlan.plan.name}
          days={proposal.currentPlan.days.map(({ dayOfWeek, assignment }) => ({
            dayOfWeek,
            content: <CurrentAssignment assignment={assignment} />,
          }))}
        />
        <WeekColumn
          title="PROPUESTA"
          heading={proposal.proposal.name}
          days={DAY_ORDER.map((dayOfWeek) => {
            const proposedDay = proposal.proposal.days.find((day) => day.dayOfWeek === dayOfWeek);
            return {
              dayOfWeek,
              content: proposedDay ? <ProposedAssignment day={proposedDay} /> : <p>Descanso</p>,
            };
          })}
        />
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
      <div className="space-y-4 rounded-xl bg-surface p-4 ring-1 ring-line">
        <label className="flex min-h-11 items-start gap-3 text-sm leading-6 text-ink">
          <input
            type="checkbox"
            checked={replacementConfirmed}
            onChange={(event) => onConfirmationChange(event.currentTarget.checked)}
            className="mt-1 size-5 accent-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          />
          Confirmo reemplazar mi plan semanal activo con esta propuesta.
        </label>
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            disabled={!replacementConfirmed || applying}
            onClick={onConfirm}
            className={buttonClassName({ size: 'lg', className: 'min-h-11 w-full sm:w-auto' })}
          >
            {applying ? 'Guardando…' : 'Guardar y reemplazar plan'}
          </button>
          <button
            type="button"
            disabled={applying}
            onClick={onCancel}
            className={buttonClassName({
              variant: 'secondary',
              size: 'lg',
              className: 'min-h-11 w-full sm:w-auto',
            })}
          >
            Cancelar propuesta
          </button>
        </div>
      </div>
    </div>
  );
}

function WeekColumn({
  title,
  heading,
  days,
}: {
  title: string;
  heading: string;
  days: Array<{ dayOfWeek: number; content: ReactNode }>;
}) {
  return (
    <section aria-label={title} className="space-y-3">
      <div>
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-brand">{title}</h2>
        <p className="mt-1 break-words font-serif text-lg font-semibold text-ink">{heading}</p>
      </div>
      <ul className="space-y-2">
        {DAY_ORDER.map((dayOfWeek) => {
          const day = days.find((item) => item.dayOfWeek === dayOfWeek);
          return day ? (
            <li key={`${title}-${dayOfWeek}`} className="rounded-xl bg-surface p-3 ring-1 ring-line">
              <h3 className="text-sm font-semibold text-ink">{PLAN_DAY_LABELS[dayOfWeek]}</h3>
              <div className="mt-2 space-y-1 text-sm leading-5 text-ink-muted">{day.content}</div>
            </li>
          ) : null;
        })}
      </ul>
    </section>
  );
}

function CurrentAssignment({ assignment }: { assignment: TrainingPlanImprovementAssignment }) {
  if (assignment.kind === 'rest') {
    return <p>Descanso</p>;
  }
  if (assignment.kind === 'unavailable') {
    return <p>Rutina no disponible</p>;
  }

  return (
    <>
      <p className="font-semibold text-ink">{assignment.routineName}</p>
      {assignment.focus ? <p>Foco: {assignment.focus}</p> : null}
      {assignment.exercises.length > 0 ? (
        <ul className="space-y-1">
          {assignment.exercises.map((exercise) => (
            <li key={`${assignment.routineId}-${exercise.exerciseId}`}>
              {exercise.exerciseName} · {exercise.targetSets} × {exercise.targetReps}
            </li>
          ))}
        </ul>
      ) : (
        <p>Sin ejercicios disponibles</p>
      )}
    </>
  );
}

function ProposedAssignment({ day }: { day: WeeklyPlanDraft['days'][number] }) {
  return (
    <>
      <p className="font-semibold text-ink">{day.title}</p>
      <p>Foco: {day.focus}</p>
      <ul className="space-y-1">
        {day.exercises.map((exercise) => (
          <li key={`${day.dayOfWeek}-${exercise.exerciseId}`}>
            {exercise.exerciseName} · {exercise.targetSets} × {exercise.targetReps}
          </li>
        ))}
      </ul>
    </>
  );
}
