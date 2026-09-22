'use client';

import { useEffect, useState, type JSX } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { TopographicTexture } from '@/components/today/TopographicTexture';
import {
  CompletionMeter,
  GoalPill,
  KindPill,
  ReasonNote,
  RetryableError,
  StatsRow,
} from '@/components/today/TodayWorkoutHeroParts';
import { fetchRoutineDetail } from '@/lib/api/routine-detail';
import { useToday } from '@/hooks/useToday';
import type { RoutineDetail } from '@/lib/api/routine-detail';

interface TodayWorkoutHeroProps {
  onStartWorkout?: () => void;
  onAdapt?: () => void;
  onCreatePlan?: () => void;
}

type DetailState =
  | { status: 'idle'; routine: null; error: null }
  | { status: 'loading'; routine: null; error: null }
  | { status: 'loaded'; routine: RoutineDetail; error: null }
  | { status: 'error'; routine: null; error: string };

const COPY = {
  eyebrow: 'ENTRENAMIENTO DE HOY',
  start: 'Empezar entrenamiento ▷',
  repeat: 'Entrenar de nuevo',
  adapt: '✦ Adaptar con Coach Atlas',
  retry: 'Reintentar',
  createPlan: 'Crear mi plan',
  noPlanTitle: 'Todavía no tenés un plan',
  noPlanDescription: 'Creá tu plan para que Atlas pueda mostrarte el entrenamiento correcto cada día.',
  restTitle: 'Hoy es día de descanso',
  restDescription: 'Tu plan marca pausa para hoy. Volvé cuando toque entrenar.',
  routineMissing: 'La rutina programada no está disponible.',
  routineDetailLoading: 'Cargando detalle de rutina…',
  routineDetailError: 'No se pudo cargar el detalle de la rutina.',
  gym: 'Gimnasio',
  home: 'Casa',
  goalLabel: 'Objetivo del plan',
  reasonLabel: 'Por qué hoy',
  completionLabel: 'Avance de hoy',
  completionUnit: 'ejercicios',
  completionDone: 'Completaste el entrenamiento de hoy',
};

/**
 * Renders the data-honest Today workout hero card.
 * @param props Optional page-layer callbacks.
 * @returns UI for every Today union state.
 * @example <TodayWorkoutHero onStartWorkout={start} onAdapt={openCoach} />
 */
export function TodayWorkoutHero({
  onStartWorkout,
  onAdapt,
  onCreatePlan,
}: TodayWorkoutHeroProps): JSX.Element | null {
  const { today, loading, error, reload } = useToday();
  const [detailState, setDetailState] = useState<DetailState>({
    status: 'idle', routine: null, error: null,
  });
  const [detailRequestId, setDetailRequestId] = useState(0);

  const workoutRoutineId = today?.kind === 'workout' ? today.routineId : null;
  const detailKey = workoutRoutineId === null ? null : `${workoutRoutineId}:${detailRequestId}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  if (detailKey !== loadedKey) {
    setLoadedKey(detailKey);
    setDetailState(
      detailKey === null
        ? { status: 'idle', routine: null, error: null }
        : { status: 'loading', routine: null, error: null },
    );
  }

  useEffect(() => {
    if (workoutRoutineId === null) {
      return undefined;
    }

    const routineId = workoutRoutineId;
    let cancelled = false;

    async function loadRoutine(): Promise<void> {
      try {
        const routine = await fetchRoutineDetail(routineId);
        if (!cancelled) {
          setDetailState({ status: 'loaded', routine, error: null });
        }
      } catch {
        if (!cancelled) {
          setDetailState({ status: 'error', routine: null, error: COPY.routineDetailError });
        }
      }
    }

    void loadRoutine();
    return () => {
      cancelled = true;
    };
  }, [workoutRoutineId, detailRequestId]);

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <RetryableError message={error} onRetry={reload} retryLabel={COPY.retry} />;
  }

  if (!today) {
    return null;
  }

  switch (today.kind) {
    case 'workout': {
      const routine = detailState.status === 'loaded' && detailState.routine.id === today.routineId ? detailState.routine : null;
      const metrics = routine ? buildMetrics(routine) : null;
      const workoutCompleted = today.completion.total > 0 && today.completion.completed >= today.completion.total;
      return (
        <Card tone="brand" className="relative min-w-0 space-y-6 overflow-hidden rounded-[2rem] p-5 sm:p-7">
          <TopographicTexture className="text-brand opacity-[0.06]" />
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div className="flex shrink-0 items-center gap-2 text-[0.68rem] font-semibold tracking-[0.18em] text-brand">
              <span className="size-2 rounded-full bg-brand" aria-hidden="true" />
              <span>{COPY.eyebrow}</span>
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
              {today.planGoal ? <GoalPill goal={today.planGoal} label={COPY.goalLabel} /> : null}
              {routine ? <KindPill kind={routine.kind} gymLabel={COPY.gym} homeLabel={COPY.home} /> : null}
            </div>
          </div>

          <div className="relative min-w-0 space-y-3">
            <h2 className="max-w-full text-balance font-serif text-[clamp(2rem,9vw,3rem)] font-semibold leading-[0.96] tracking-[-0.04em] text-ink">
              {today.routineName}
            </h2>
            {routine?.description ? (
              <p className="text-sm leading-6 text-ink-muted">{routine.description}</p>
            ) : null}
            {today.dayReason ? <ReasonNote reason={today.dayReason} label={COPY.reasonLabel} /> : null}
          </div>

          {detailState.status === 'loading' ? (
            <p className="relative text-sm text-ink-muted" role="status">{COPY.routineDetailLoading}</p>
          ) : null}
          {detailState.status === 'error' ? (
            <RetryableError
              message={detailState.error}
              onRetry={() => setDetailRequestId((current) => current + 1)}
              retryLabel={COPY.retry}
              compact
            />
          ) : null}
          {metrics ? <StatsRow exercises={metrics.exercises} series={metrics.series} /> : null}

          {today.completion.total > 0 ? (
            <CompletionMeter
              completed={today.completion.completed}
              total={today.completion.total}
              label={COPY.completionLabel}
              unit={COPY.completionUnit}
              doneLabel={COPY.completionDone}
            />
          ) : null}

          <div className="relative space-y-3">
            {workoutCompleted ? (
              <Button size="lg" variant="secondary" onClick={onStartWorkout}>{COPY.repeat}</Button>
            ) : (
              <Button size="lg" onClick={onStartWorkout}>{COPY.start}</Button>
            )}
            <Button size="lg" variant="ghost" className="border border-ink/20" onClick={onAdapt}>{COPY.adapt}</Button>
          </div>
        </Card>
      );
    }
    case 'rest_day':
      return <EmptyState title={COPY.restTitle} description={COPY.restDescription} />;
    case 'no_plan':
      return (
        <EmptyState
          title={COPY.noPlanTitle}
          description={COPY.noPlanDescription}
          action={<Button onClick={onCreatePlan ?? onAdapt}>{COPY.createPlan}</Button>}
        />
      );
    case 'routine_missing':
      return <RetryableError message={COPY.routineMissing} onRetry={reload} retryLabel={COPY.retry} />;
  }
}

function buildMetrics(routine: RoutineDetail): { exercises: number; series: number } {
  const exercises = routine.exercises.length;
  const series = routine.exercises.reduce((total, item) => total + item.targetSets, 0);
  return { exercises, series };
}
