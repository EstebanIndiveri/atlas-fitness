'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import { PlanBuilderForm } from '@/components/plan/PlanBuilderForm';
import { PageContainer } from '@/components/shell/PageContainer';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useEditableTrainingPlan, usePlanBuilder } from '@/hooks/usePlanBuilder';
import { useRoutineList } from '@/hooks/useRoutineList';
import { PLAN_COPY } from '@/lib/copy/plan';
import type { CreateTrainingPlanResult } from '@/lib/services/training-plan';

function parsePlanRouteId(id: string | undefined): number | undefined {
  if (!id || !/^[1-9]\d*$/.test(id)) {
    return undefined;
  }
  return Number(id);
}

export default function EditPlanPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const planId = parsePlanRouteId(typeof params.id === 'string' ? params.id : undefined);
  const planState = useEditableTrainingPlan(planId);

  if (planState.loading) {
    return <LoadingState />;
  }

  if (planState.notFound || planId === undefined) {
    return (
      <PageContainer>
        <EmptyState
          title="Plan no encontrado"
          description="No existe o no está disponible para tu cuenta."
          actions={[{ label: 'Crear un plan', href: '/dashboard/plan/new' }]}
        />
      </PageContainer>
    );
  }

  if (planState.error) {
    return (
      <PageContainer>
        <ErrorState message={planState.error ?? PLAN_COPY.genericError} />
      </PageContainer>
    );
  }

  if (!planState.plan) {
    return <LoadingState />;
  }

  return (
    <EditPlanForm
      planId={planId}
      initialPlan={planState.plan}
      onSaved={() => router.push(`/dashboard/plan/${planId}`)}
    />
  );
}

function EditPlanForm({
  planId,
  initialPlan,
  onSaved,
}: {
  planId: number;
  initialPlan: CreateTrainingPlanResult;
  onSaved: () => void;
}) {
  const { routines, loading: routinesLoading, error: routinesError } = useRoutineList();
  const builder = usePlanBuilder(routines, { mode: 'edit', initialPlan });

  if (routinesLoading) {
    return <LoadingState />;
  }

  if (routinesError) {
    return (
      <PageContainer>
        <ErrorState message={routinesError} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Link href={`/dashboard/plan/${planId}`} className="text-sm font-medium text-brand hover:underline">
        Volver al plan
      </Link>
      <div className="mt-4">
        <PlanBuilderForm
          mode="edit"
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
            void builder.submit().then((updated) => {
              if (updated) onSaved();
            });
          }}
        />
      </div>
    </PageContainer>
  );
}
