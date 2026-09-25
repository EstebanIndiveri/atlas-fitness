'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { RoutineList } from '@/components/routines/RoutineList';
import { PageContainer } from '@/components/shell/PageContainer';
import { buttonClassName } from '@/components/ui/Button';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useRoutineList } from '@/hooks/useRoutineList';
import { fetchToday } from '@/lib/api/today';
import { ROUTINE_COPY, ROUTINE_TEST_IDS } from '@/lib/copy/routines';

export default function RoutinesPage() {
  const { routines, loading, error, deletingId, remove } = useRoutineList();
  const [planNavigation, setPlanNavigation] = useState<
    | { status: 'loading' }
    | { status: 'active'; planId: number }
    | { status: 'none' }
    | { status: 'error' }
  >({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentPlan(): Promise<void> {
      try {
        const today = await fetchToday();
        if (cancelled) return;
        setPlanNavigation(
          today.kind === 'no_plan'
            ? { status: 'none' }
            : { status: 'active', planId: today.trainingPlanId },
        );
      } catch {
        if (!cancelled) {
          setPlanNavigation({ status: 'error' });
        }
      }
    }

    void loadCurrentPlan();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <LoadingState />;
  }

  return (
    <PageContainer>
      {planNavigation.status === 'error' ? (
        <p role="alert" className="mb-4 text-sm text-danger">
          No pudimos cargar el plan semanal. Probá de nuevo.
        </p>
      ) : null}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-title font-bold text-ink">{ROUTINE_COPY.listTitle}</h1>
          <p className="mt-1 text-sm text-ink-muted">{ROUTINE_COPY.listSubtitle}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Link
            href="/dashboard/routines/coach"
            className={buttonClassName({ size: 'lg', className: 'min-h-11 sm:w-auto' })}
            data-testid={ROUTINE_TEST_IDS.createCoachCta}
            aria-label="Crear rutina con Coach Atlas"
          >
            {ROUTINE_COPY.createCoachCta}
          </Link>
          <Link
            href="/dashboard/routines/new"
            className={buttonClassName({ variant: 'secondary', size: 'lg', className: 'min-h-11 sm:w-auto' })}
            data-testid={ROUTINE_TEST_IDS.createCta}
            aria-label="Crear rutina manual"
          >
            {ROUTINE_COPY.createCta}
          </Link>
          {planNavigation.status !== 'loading' && planNavigation.status !== 'error' ? (
            <Link
              href={
                planNavigation.status === 'active'
                  ? `/dashboard/plan/${planNavigation.planId}`
                  : '/dashboard/plan/new'
              }
              className={buttonClassName({ variant: 'secondary', size: 'lg', className: 'min-h-11 sm:w-auto' })}
            >
              {planNavigation.status === 'active' ? 'Gestionar plan' : 'Crear plan semanal'}
            </Link>
          ) : null}
        </div>
      </div>
      {error ? <div className="mb-4"><ErrorState message={error} /></div> : null}
      <RoutineList routines={routines} onDelete={(id) => void remove(id)} deletingId={deletingId} />
    </PageContainer>
  );
}
