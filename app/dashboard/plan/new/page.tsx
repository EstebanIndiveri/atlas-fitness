'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { PlanBuilderForm } from '@/components/plan/PlanBuilderForm';
import { PageContainer } from '@/components/shell/PageContainer';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { usePlanBuilder } from '@/hooks/usePlanBuilder';
import { useRoutineList } from '@/hooks/useRoutineList';
import { PLAN_COPY } from '@/lib/copy/plan';
import { buttonClassName } from '@/components/ui/Button';

export default function NewPlanPage() {
  const router = useRouter();
  const { routines, loading, error } = useRoutineList();
  const builder = usePlanBuilder(routines);

  return (
    <PageContainer>
      <Link href="/dashboard/today" className="text-sm font-medium text-brand hover:underline">
        {PLAN_COPY.backToToday}
      </Link>

      <div className="mt-4">
        <Card className="mb-4 rounded-2xl border border-brand/20 bg-brand-muted/60">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">Coach Atlas</p>
          <h1 className="mt-1 text-xl font-bold text-ink">Armá tu semana con guía</h1>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            Respondé un brief corto, revisá los días propuestos y guardá el plan completo.
          </p>
          <Link href="/dashboard/plan/guided" className={buttonClassName({ className: 'mt-4 w-full' })}>
            ✦ Crear con Coach Atlas (guiado)
          </Link>
        </Card>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : routines.length === 0 ? (
          <EmptyState
            title={PLAN_COPY.emptyRoutinesTitle}
            description={PLAN_COPY.emptyRoutinesBody}
            actions={[
              { label: PLAN_COPY.emptyRoutinesCoach, href: '/dashboard/routines/coach' },
              {
                label: PLAN_COPY.emptyRoutinesManual,
                href: '/dashboard/routines/new',
                variant: 'secondary',
              },
            ]}
          />
        ) : (
          <PlanBuilderForm
            routines={routines}
            name={builder.name}
            goal={builder.goal}
            assignments={builder.assignments}
            selectedCount={builder.selectedCount}
            canSubmit={builder.canSubmit}
            submitting={builder.submitting}
            error={builder.error}
            onNameChange={builder.setName}
            onGoalChange={builder.setGoal}
            onDayRoutineChange={builder.setDayRoutine}
            onDayNoteChange={builder.setDayNote}
            onSubmit={() => {
              void builder.submit().then((created) => {
                if (created) router.push('/dashboard/today');
              });
            }}
          />
        )}
      </div>
    </PageContainer>
  );
}
