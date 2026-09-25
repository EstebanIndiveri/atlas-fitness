'use client';

import Link from 'next/link';

import { PageContainer } from '@/components/shell/PageContainer';
import { buttonClassName } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useTrainingPlanHub } from '@/hooks/useTrainingPlanHub';
import { PLAN_DAY_LABELS } from '@/lib/copy/plan';
import type { TrainingPlanHubDto } from '@/types/training-plan-hub';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/**
 * Presents the persisted weekly plan with separate states for rest and unavailable routines.
 *
 * @param planId - Persisted plan id selected by the route.
 * @returns Accessible current-plan hub and its loading/error states.
 * @example
 * <TrainingPlanHub planId={12} />
 */
export function TrainingPlanHub({ planId }: { planId: number }) {
  const state = useTrainingPlanHub(planId);

  if (state.status === 'loading') {
    return (
      <PageContainer>
        <LoadingState label="Cargando tu plan semanal…" />
      </PageContainer>
    );
  }

  if (state.status === 'not_found') {
    return (
      <PageContainer>
        <EmptyState
          title="Plan no encontrado"
          description="No existe o no está disponible para tu cuenta."
          actions={[{ label: 'Volver a Entrenar', href: '/dashboard/session' }]}
        />
      </PageContainer>
    );
  }

  if (state.status === 'error') {
    return (
      <PageContainer>
        <ErrorState title="No se pudo cargar el plan" message={state.error} compact={false} />
      </PageContainer>
    );
  }

  return <TrainingPlanHubContent hub={state.data} />;
}

function TrainingPlanHubContent({ hub }: { hub: TrainingPlanHubDto }) {
  return (
    <PageContainer className="space-y-6">
      <section aria-label="Plan semanal" className="space-y-6">
        <header className="space-y-4">
          <Link
            href="/dashboard/session"
            className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            ← Volver a Entrenar
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
                Plan semanal
              </p>
              <h1 className="mt-1 break-words font-serif text-3xl font-semibold tracking-[-0.04em] text-ink">
                {hub.plan.name}
              </h1>
            </div>
            <span
              className={
                hub.plan.isActive
                  ? 'rounded-full bg-brand-muted px-3 py-1.5 text-xs font-semibold text-brand'
                  : 'rounded-full bg-canvas px-3 py-1.5 text-xs font-semibold text-ink-muted ring-1 ring-line'
              }
            >
              {hub.plan.isActive ? 'Plan activo' : 'Plan inactivo'}
            </span>
          </div>
          <div className="rounded-xl bg-surface p-4 shadow-card ring-1 ring-line">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Objetivo del plan
            </p>
            <p className="mt-1 text-base font-semibold text-ink">
              {hub.plan.goal ?? 'Sin objetivo definido'}
            </p>
          </div>
          <nav aria-label="Acciones del plan" className="grid gap-2 sm:flex sm:flex-wrap">
            <Link
              href={`/dashboard/plan/${hub.plan.id}/edit`}
              className={buttonClassName({ size: 'lg', className: 'min-h-11 w-full sm:w-auto' })}
            >
              Editar plan semanal
            </Link>
            {hub.plan.isActive ? (
              <Link
                href={`/dashboard/plan/${hub.plan.id}/improve`}
                className={buttonClassName({
                  variant: 'secondary',
                  size: 'lg',
                  className: 'min-h-11 w-full sm:w-auto',
                })}
              >
                Mejorar plan con Coach Atlas
              </Link>
            ) : null}
          </nav>
        </header>

        <section aria-labelledby="plan-hub-week-title" aria-label="Semana del plan" className="space-y-3">
          <div>
            <h2
              id="plan-hub-week-title"
              className="font-serif text-xl font-semibold tracking-[-0.03em] text-ink"
            >
              Tu semana
            </h2>
            <p className="mt-1 text-sm text-ink-muted">Rutinas asignadas y días de descanso.</p>
          </div>
          <ul
            data-testid="plan-hub-week-grid"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {DAY_ORDER.map((dayOfWeek) => {
              const day = hub.days.find((item) => item.dayOfWeek === dayOfWeek);
              return day ? (
                <li
                  key={dayOfWeek}
                  className="flex min-h-32 flex-col rounded-xl bg-surface p-4 shadow-card ring-1 ring-line"
                >
                  <h3 className="text-sm font-semibold text-ink">{PLAN_DAY_LABELS[dayOfWeek]}</h3>
                  <AssignmentContent assignment={day.assignment} />
                </li>
              ) : null;
            })}
          </ul>
        </section>
      </section>
    </PageContainer>
  );
}

function AssignmentContent({ assignment }: { assignment: TrainingPlanHubDto['days'][number]['assignment'] }) {
  if (assignment.kind === 'rest') {
    return <p className="mt-3 text-sm text-ink-muted">Descanso</p>;
  }

  if (assignment.kind === 'unavailable') {
    return (
      <div className="mt-3 space-y-1">
        <p className="text-sm font-medium text-ink-muted">Rutina no disponible</p>
        <p className="text-xs leading-5 text-ink-muted">
          Esta asignación no se puede mostrar en tu catálogo actual.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-1 flex-col items-start gap-2">
      <p className="text-sm font-semibold text-ink">{assignment.routineName}</p>
      {assignment.focus ? (
        <p className="text-xs leading-5 text-ink-muted">
          <span className="font-medium">Foco:</span> {assignment.focus}
        </p>
      ) : null}
      {assignment.routineDescription ? (
        <p className="text-xs leading-5 text-ink-muted">{assignment.routineDescription}</p>
      ) : null}
      <Link
        href={`/dashboard/routines/${assignment.routineId}`}
        className="mt-auto inline-flex min-h-11 items-center text-sm font-semibold text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        aria-label={`Ver rutina ${assignment.routineName}`}
      >
        Ver rutina
      </Link>
    </div>
  );
}
