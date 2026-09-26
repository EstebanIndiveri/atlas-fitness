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
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { UI_COPY } from '@/lib/copy/ui';
import { useCoachAdapt } from '@/hooks/useCoachAdapt';
import { useDailyCheckin } from '@/hooks/useDailyCheckin';
import { isCheckInEnergy, isCheckInMood } from '@/lib/api/checkin';

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
  const routineId = parsePositiveId(searchParams.get('routineId'));
  const trainingPlanId = parsePositiveId(searchParams.get('trainingPlanId'));
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

  return (
    <AdaptWorkoutContent
      routineId={routineId}
      trainingPlanId={trainingPlanId}
      routineName={routineName}
      planGoal={planGoal}
    />
  );
}

function AdaptWorkoutContent({
  routineId,
  trainingPlanId,
  routineName,
  planGoal,
}: {
  routineId: number;
  trainingPlanId: number | null;
  routineName: string;
  planGoal: string | null;
}) {
  const checkIn = useDailyCheckin();
  const checkInData = checkIn.checkin;
  const currentCheckInContext = checkInData !== null
    && Number.isInteger(checkInData.id)
    && checkInData.id > 0
    && isCheckInEnergy(checkInData.energy)
    && isCheckInMood(checkInData.mood)
    ? {
        dailyCheckInId: checkInData.id,
        mood: checkInData.mood,
        energy: checkInData.energy,
      }
    : null;
  const hasCompleteCheckIn = !checkIn.loading
    && !checkIn.saving
    && checkIn.error === null
    && currentCheckInContext !== null;
  const checkInContext = hasCompleteCheckIn ? currentCheckInContext : null;
  const adapt = useCoachAdapt({ routineId, trainingPlanId, checkInContext });

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

      {checkIn.loading ? <LoadingState label="Cargando tu check-in de hoy…" compact /> : null}
      {checkIn.saving ? <LoadingState label="Guardando tu check-in…" compact /> : null}
      {checkIn.error ? <ErrorState message={checkIn.error} /> : null}
      {!checkIn.loading && !checkIn.error && !hasCompleteCheckIn ? (
        <Card className="space-y-3 rounded-xl">
          <p className="text-sm leading-6 text-ink-muted">
            Registrá tu ánimo y energía en Hoy antes de pedir una vista previa. El texto por sí solo no aporta esos datos.
          </p>
          <Link href="/dashboard/today" className={buttonClassName()}>
            Registrar mi check-in
          </Link>
        </Card>
      ) : null}

      {hasCompleteCheckIn && adapt.step === 'motivo' ? (
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

function parsePositiveId(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
