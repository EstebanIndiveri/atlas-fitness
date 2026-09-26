'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { PlanBuilderForm } from '@/components/plan/PlanBuilderForm';
import { PageContainer } from '@/components/shell/PageContainer';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { usePlanBuilder } from '@/hooks/usePlanBuilder';
import { useRoutineList } from '@/hooks/useRoutineList';
import {
  PLAN_COPY,
  TRAINING_PLAN_REPLACEMENT_CONFIRMATION,
} from '@/lib/copy/plan';
import { buttonClassName } from '@/components/ui/Button';
import { getActiveTrainingPlan, TrainingPlanClientError } from '@/lib/api/training-plan';
import type { CreateTrainingPlanResult } from '@/lib/services/training-plan';

export default function NewPlanPage() {
  const router = useRouter();
  const [activePlan, setActivePlan] = useState<CreateTrainingPlanResult | null>(null);
  const [activePlanLoading, setActivePlanLoading] = useState(true);
  const [activePlanError, setActivePlanError] = useState<string | null>(null);
  const { routines, loading, error } = useRoutineList(activePlan?.plan.id);
  const builder = usePlanBuilder(routines, { replacementPlan: activePlan });

  useEffect(() => {
    let cancelled = false;
    async function loadActivePlan(): Promise<void> {
      try {
        const result = await getActiveTrainingPlan();
        if (!cancelled) {
          setActivePlan(result);
          setActivePlanError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setActivePlanError(
            cause instanceof TrainingPlanClientError ? cause.message : PLAN_COPY.genericError,
          );
        }
      } finally {
        if (!cancelled) {
          setActivePlanLoading(false);
        }
      }
    }
    void loadActivePlan();
    return () => {
      cancelled = true;
    };
  }, []);

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
        {loading || activePlanLoading ? (
          <LoadingState />
        ) : error || activePlanError ? (
          <ErrorState message={error ?? activePlanError ?? PLAN_COPY.genericError} />
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
            canSubmit={builder.canSubmit && !activePlanLoading}
            submitting={builder.submitting}
            error={builder.error}
            onNameChange={builder.setName}
            onGoalChange={builder.setGoal}
            onDayRoutineChange={builder.setDayRoutine}
            onDayNoteChange={builder.setDayNote}
            onSubmit={() => {
              if (activePlan && !window.confirm(TRAINING_PLAN_REPLACEMENT_CONFIRMATION)) {
                return;
              }
              void builder.submit().then((created) => {
                if (created) router.push(`/dashboard/plan/${created.plan.id}`);
              });
            }}
          />
        )}
      </div>
    </PageContainer>
  );
}
