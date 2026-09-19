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
        <Link
          href="/dashboard/routines/new"
          className={buttonClassName()}
          data-testid={ROUTINE_TEST_IDS.createCta}
        >
          {ROUTINE_COPY.createCta}
        </Link>
      </div>
      {error ? <div className="mb-4"><ErrorState message={error} /></div> : null}
      <RoutineList routines={routines} onDelete={(id) => void remove(id)} deletingId={deletingId} />
    </PageContainer>
  );
}
