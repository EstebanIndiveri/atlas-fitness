'use client';

import Link from 'next/link';

import { NewRoutineActions } from '@/components/training/NewRoutineActions';
import { MyRoutinesList } from '@/components/training/MyRoutinesList';
import { TrainingTodayHero } from '@/components/training/TrainingTodayHero';
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
          <h1 className="text-title font-bold text-ink">{UI_COPY.training.title}</h1>
        </div>
        <Link
          href="/dashboard/routines"
          className="text-sm font-medium text-brand hover:underline"
          data-testid={ROUTINE_TEST_IDS.manageCta}
        >
          {UI_COPY.training.managePlan}
        </Link>
      </header>

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error && today ? (
        <TrainingTodayHero
          today={today}
          activeWorkout={activeWorkout}
          starting={starting}
          onStart={(routineId) => void start(routineId)}
        />
      ) : null}
      {!loading && !error ? (
        <>
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
