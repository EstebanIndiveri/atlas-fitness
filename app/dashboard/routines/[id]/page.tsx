'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RoutineDetailTabs } from '@/components/routines/RoutineDetailTabs';
import { RoutineExerciseSequence } from '@/components/routines/RoutineExerciseSequence';
import { RoutineSummaryCard } from '@/components/routines/RoutineSummaryCard';
import { PageContainer } from '@/components/shell/PageContainer';
import { ErrorState, EmptyState, LoadingState } from '@/components/ui/states';
import { fetchRoutine, RoutineClientError } from '@/lib/routines/client';
import { ROUTINE_COPY, ROUTINE_TEST_IDS } from '@/lib/copy/routines';
import type { RoutineSummary } from '@/types/routine';

type RoutineDetailState =
  | { status: 'loading'; routine: null; message: null }
  | { status: 'ready'; routine: RoutineSummary; message: null }
  | { status: 'not_found'; routine: null; message: null }
  | { status: 'error'; routine: null; message: string };

function parseRoutineId(rawId: string | string[] | undefined): number | null {
  if (typeof rawId !== 'string') {
    return null;
  }
  const parsed = Number.parseInt(rawId, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseTrainingPlanId(rawId: string | null): number | undefined | null {
  if (rawId === null) {
    return undefined;
  }
  if (!/^[1-9]\d*$/.test(rawId)) {
    return null;
  }
  return Number(rawId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isPositiveInteger(value: unknown): value is number {
  return isInteger(value) && value > 0;
}

async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function fetchActiveWorkoutHref(): Promise<string | null> {
  const response = await fetch('/api/workouts/active');
  const body = await readJsonBody(response);
  if (!response.ok || !isRecord(body) || !isPositiveInteger(body.id)) {
    return null;
  }
  return isPositiveInteger(body.routineId)
    ? `/dashboard/session/${body.id}`
    : `/dashboard/workout/${body.id}`;
}

function mapLoadError(error: unknown): RoutineDetailState {
  if (error instanceof RoutineClientError && error.kind === 'not_found') {
    return { status: 'not_found', routine: null, message: null };
  }
  const message = error instanceof RoutineClientError ? error.message : ROUTINE_COPY.errorLoad;
  return { status: 'error', routine: null, message };
}

export default function RoutineDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const routineId = useMemo(() => parseRoutineId(params.id), [params.id]);
  const trainingPlanId = useMemo(
    () => parseTrainingPlanId(searchParams.get('trainingPlanId')),
    [searchParams],
  );
  const [state, setState] = useState<RoutineDetailState>({ status: 'loading', routine: null, message: null });
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRoutine(): Promise<void> {
      if (routineId === null || trainingPlanId === null) {
        setState({ status: 'not_found', routine: null, message: null });
        return;
      }

      setState({ status: 'loading', routine: null, message: null });
      try {
        const routine = await fetchRoutine(routineId, trainingPlanId);
        if (!cancelled) {
          setState({ status: 'ready', routine, message: null });
        }
      } catch (error) {
        if (!cancelled) {
          setState(mapLoadError(error));
        }
      }
    }

    void loadRoutine();
    return () => {
      cancelled = true;
    };
  }, [routineId, trainingPlanId]);

  const startWorkout = useCallback(async (): Promise<void> => {
    if (state.status !== 'ready') {
      return;
    }
    setStarting(true);
    setStartError(null);
    try {
      const response = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routineId: state.routine.id,
          ...(trainingPlanId !== undefined ? { trainingPlanId } : {}),
        }),
      });
      const body = await readJsonBody(response);
      if (response.status === 409) {
        const activeHref = await fetchActiveWorkoutHref();
        if (activeHref !== null) {
          router.push(activeHref);
          return;
        }
      }
      if (!response.ok || !isRecord(body) || !isInteger(body.id)) {
        throw new Error('Invalid workout start response');
      }
      router.push(`/dashboard/session/${body.id}`);
    } catch {
      setStartError(ROUTINE_COPY.startError);
    } finally {
      setStarting(false);
    }
  }, [router, state, trainingPlanId]);

  if (state.status === 'loading') {
    return <LoadingState />;
  }

  if (state.status === 'not_found') {
    return (
      <PageContainer>
        <div data-testid={ROUTINE_TEST_IDS.notFound}>
          <EmptyState
            title={ROUTINE_COPY.notFound}
            description={ROUTINE_COPY.notFoundBody}
            action={
              <Link href="/dashboard/routines" className="text-sm font-medium text-brand hover:underline">
                {ROUTINE_COPY.backToList}
              </Link>
            }
          />
        </div>
      </PageContainer>
    );
  }

  if (state.status === 'error') {
    return (
      <PageContainer>
        <ErrorState message={state.message} compact={false} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-4" data-testid={ROUTINE_TEST_IDS.detail}>
        <header className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
          <Link href="/dashboard/routines" className="text-sm font-medium text-ink hover:text-brand">
            ← {ROUTINE_COPY.navRoutines}
          </Link>
          <div className="text-center">
            <p className="text-base font-bold text-ink">{ROUTINE_COPY.detailTitle}</p>
            <p className="mt-1 text-xs text-ink-muted">{state.routine.name}</p>
          </div>
          <div className="text-right text-lg font-bold text-ink-muted" aria-hidden="true">
            …
          </div>
        </header>

        <RoutineDetailTabs routineId={state.routine.id} />
        <RoutineSummaryCard
          routine={state.routine}
          starting={starting}
          error={startError}
          onStart={() => void startWorkout()}
        />
        <RoutineExerciseSequence routine={state.routine} />
      </div>
    </PageContainer>
  );
}
