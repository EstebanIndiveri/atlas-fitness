'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { AdaptComparison } from '@/components/coach/AdaptComparison';
import { AdaptMotivoForm } from '@/components/coach/AdaptMotivoForm';
import { AdaptStepIndicator } from '@/components/coach/AdaptStepIndicator';
import { PageContainer } from '@/components/shell/PageContainer';
import { Button, buttonClassName } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { UI_COPY } from '@/lib/copy/ui';
import { useCoachAdapt } from '@/hooks/useCoachAdapt';

const FALLBACK_ROUTINE_NAME = 'Rutina de hoy';

/**
 * Route for the Coach Atlas workout adaptation screen.
 *
 * @returns Client page reading routine details from query params inside a Suspense boundary.
 * @example
 * <AdaptWorkoutPage />
 */
export default function AdaptWorkoutPage() {
  return (
    <Suspense fallback={<PageContainer><Card><LoadingState compact /></Card></PageContainer>}>
      <AdaptWorkoutParams />
    </Suspense>
  );
}

function AdaptWorkoutParams() {
  const searchParams = useSearchParams();
  const routineId = parseRoutineId(searchParams.get('routineId'));
  const routineName = searchParams.get('routineName')?.trim() || FALLBACK_ROUTINE_NAME;
  const planGoal = searchParams.get('planGoal')?.trim() || null;

  if (routineId === null) {
    return (
      <PageContainer>
        <Card>
          <EmptyState
            title={UI_COPY.coachAdapt.emptyTitle}
            description={UI_COPY.coachAdapt.emptyBody}
            action={(
              <Link href="/dashboard/session" className={buttonClassName()}>
                {UI_COPY.coachAdapt.goTraining}
              </Link>
            )}
          />
        </Card>
      </PageContainer>
    );
  }

  return <AdaptWorkoutContent routineId={routineId} routineName={routineName} planGoal={planGoal} />;
}

function AdaptWorkoutContent({
  routineId,
  routineName,
  planGoal,
}: {
  routineId: number;
  routineName: string;
  planGoal: string | null;
}) {
  const adapt = useCoachAdapt({ routineId });

  return (
    <PageContainer className="space-y-5 pb-24">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-title font-bold text-ink">{UI_COPY.coachAdapt.title}</h1>
          <span className="rounded-full bg-brand-muted px-3 py-1 text-xs font-semibold text-brand ring-1 ring-brand/20">
            {UI_COPY.coachAdapt.badge}
          </span>
        </div>
        <p className="text-sm leading-6 text-ink-muted">{UI_COPY.coachAdapt.subtitle}</p>
        <AdaptStepIndicator current={adapt.step} />
      </header>

      <Card tone="brand" className="space-y-2 rounded-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
          {UI_COPY.coachAdapt.baseSession}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-bold tracking-[-0.03em] text-ink">{routineName}</h2>
          {planGoal ? (
            <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-brand ring-1 ring-brand/20">
              {planGoal}
            </span>
          ) : null}
        </div>
      </Card>

      {adapt.step === 'motivo' ? (
        <AdaptMotivoForm
          loading={adapt.previewing}
          error={adapt.error}
          onSubmit={(freeText) => void adapt.previewWithContext(freeText)}
        />
      ) : null}

      {adapt.step === 'comparacion' && adapt.result ? (
        <>
          <AdaptComparison result={adapt.result} routineName={routineName} />
          <Card className="space-y-3 rounded-xl">
            <p className="text-sm leading-6 text-ink-muted">{UI_COPY.coachAdapt.guidanceDisclosure}</p>
            <Button size="lg" disabled={adapt.starting} onClick={() => void adapt.startWorkout(true)}>
              {adapt.starting ? UI_COPY.coachAdapt.starting : UI_COPY.coachAdapt.startWithGuidance}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              disabled={adapt.starting}
              onClick={() => void adapt.startWorkout(false)}
            >
              {UI_COPY.coachAdapt.keepOriginal}
            </Button>
            <Button variant="ghost" size="lg" disabled={adapt.starting} onClick={adapt.adjustAgain}>
              {UI_COPY.coachAdapt.adjustAgain}
            </Button>
            {adapt.error ? <p className="text-sm text-danger">{adapt.error}</p> : null}
          </Card>
        </>
      ) : null}

      {adapt.step === 'confirmado' ? (
        <Card tone="brand" className="rounded-xl">
          <LoadingState label={UI_COPY.coachAdapt.confirmed} compact />
        </Card>
      ) : null}
    </PageContainer>
  );
}

function parseRoutineId(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
