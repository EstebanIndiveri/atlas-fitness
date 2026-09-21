'use client';

import Link from 'next/link';
import { RoutineList } from '@/components/routines/RoutineList';
import { PageContainer } from '@/components/shell/PageContainer';
import { buttonClassName } from '@/components/ui/Button';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useRoutineList } from '@/hooks/useRoutineList';
import { ROUTINE_COPY, ROUTINE_TEST_IDS } from '@/lib/copy/routines';

export default function RoutinesPage() {
  const { routines, loading, error, deletingId, remove } = useRoutineList();

  if (loading) {
    return <LoadingState />;
  }

  return (
    <PageContainer>
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
        </div>
      </div>
      {error ? <div className="mb-4"><ErrorState message={error} /></div> : null}
      <RoutineList routines={routines} onDelete={(id) => void remove(id)} deletingId={deletingId} />
    </PageContainer>
  );
}
