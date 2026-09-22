'use client';

import Link from 'next/link';

import { NewRoutineActions } from '@/components/training/NewRoutineActions';
import { MyRoutinesList } from '@/components/training/MyRoutinesList';
import { TrainingTodayHero } from '@/components/training/TrainingTodayHero';
import { UpcomingPlanSection } from '@/components/training/UpcomingPlanSection';
import { PageContainer } from '@/components/shell/PageContainer';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { ROUTINE_TEST_IDS } from '@/lib/copy/routines';
import { UI_COPY } from '@/lib/copy/ui';
import { useTrainingLanding } from '@/hooks/useTrainingLanding';

/**
 * Entrenar landing screen for today's plan and guided routine starts.
 *
 * @returns Client page composed from data-honest training sections.
 * @throws Does not throw; hook errors render as UI state.
 * @example
 * <GuidedSessionPickerPage />
 */
export default function GuidedSessionPickerPage() {
  const { today, routines, activeWorkout, loading, error, starting, start } = useTrainingLanding();

  return (
    <PageContainer className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-[-0.04em] text-ink">
            {UI_COPY.training.title}
          </h1>
        </div>
        <Link
          href="/dashboard/routines"
          className="rounded-full bg-surface px-3 py-2 text-xs font-medium text-ink shadow-card ring-1 ring-line hover:bg-canvas"
          data-testid={ROUTINE_TEST_IDS.manageCta}
        >
          <span aria-hidden="true">⚏ </span>
          {UI_COPY.training.managePlan}
        </Link>
      </header>

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error && today ? (
        <TrainingTodayHero
          today={today}
          routines={routines}
          activeWorkout={activeWorkout}
          starting={starting}
          onStart={(routineId) => void start(routineId)}
        />
      ) : null}
      {!loading && !error ? (
        <>
          <UpcomingPlanSection today={today} routines={routines} />
          <NewRoutineActions />
          <MyRoutinesList
            routines={routines}
            activeWorkout={activeWorkout}
            starting={starting}
            onStart={(routineId) => void start(routineId)}
          />
        </>
      ) : null}
    </PageContainer>
  );
}
