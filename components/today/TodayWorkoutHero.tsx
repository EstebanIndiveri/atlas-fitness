'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { MetricValue } from '@/components/ui/MetricValue';
import { TopographicTexture } from '@/components/today/TopographicTexture';
import { fetchRoutineDetail } from '@/lib/api/routine-detail';
import { cn } from '@/lib/ui/cn';
import { useToday } from '@/hooks/useToday';
import { metric } from '@/types/metric';
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
}: TodayWorkoutHeroProps) {
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
    return <RetryableError message={error} onRetry={reload} />;
  }

  if (!today) {
    return null;
  }

  switch (today.kind) {
    case 'workout': {
      const routine = detailState.status === 'loaded' && detailState.routine.id === today.routineId ? detailState.routine : null;
      const metrics = routine ? buildMetrics(routine) : null;
      return (
        <Card tone="brand" className="relative space-y-6 overflow-hidden rounded-xl p-5 sm:p-7">
          <TopographicTexture className="text-brand opacity-[0.06]" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-brand">
              <span className="h-2.5 w-2.5 rounded-full bg-success" aria-hidden="true" />
              <span>{COPY.eyebrow}</span>
            </div>
            <div className="flex items-center gap-2">
              {today.planGoal ? <GoalPill goal={today.planGoal} /> : null}
              {routine ? <KindPill kind={routine.kind} /> : null}
            </div>
          </div>

          <div className="relative space-y-2">
            <h2 className="font-serif text-3xl font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-4xl">
              {today.routineName}
            </h2>
            {routine?.description ? (
              <p className="text-sm leading-6 text-ink-muted">{routine.description}</p>
            ) : null}
            {today.dayReason ? <ReasonNote reason={today.dayReason} /> : null}
          </div>

          {detailState.status === 'loading' ? (
            <p className="relative text-sm text-ink-muted" role="status">{COPY.routineDetailLoading}</p>
          ) : null}
          {detailState.status === 'error' ? (
            <RetryableError
              message={detailState.error}
              onRetry={() => setDetailRequestId((current) => current + 1)}
              compact
            />
          ) : null}
          {metrics ? <StatsRow exercises={metrics.exercises} series={metrics.series} minutes={metrics.minutes} /> : null}

          <div className="relative space-y-3">
            <Button size="lg" onClick={onStartWorkout}>{COPY.start}</Button>
            <Button size="lg" variant="secondary" onClick={onAdapt}>{COPY.adapt}</Button>
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
      return <RetryableError message={COPY.routineMissing} onRetry={reload} />;
  }
}

function buildMetrics(routine: RoutineDetail) {
  const exercises = routine.exercises.length;
  const series = routine.exercises.reduce((total, item) => total + item.targetSets, 0);
  return { exercises, series, minutes: series * 3 };
}

function KindPill({ kind }: { kind: RoutineDetail['kind'] }) {
  return (
    <span className="rounded-full bg-surface/80 px-3 py-1 text-xs font-medium text-ink ring-1 ring-line">
      {kind === 'gym' ? COPY.gym : COPY.home}
    </span>
  );
}

function GoalPill({ goal }: { goal: string }) {
  return (
    <span
      className="rounded-full bg-brand/12 px-3 py-1 text-xs font-semibold text-brand ring-1 ring-brand/30"
      aria-label={`${COPY.goalLabel}: ${goal}`}
    >
      {goal}
    </span>
  );
}

function ReasonNote({ reason }: { reason: string }) {
  return (
    <div
      className="flex items-start gap-2 rounded-lg bg-surface/60 px-3 py-2 text-sm text-ink-muted ring-1 ring-line"
      aria-label={`${COPY.reasonLabel}: ${reason}`}
    >
      <span className="mt-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand">
        {COPY.reasonLabel}
      </span>
      <span className="leading-5">{reason}</span>
    </div>
  );
}

const STAT_ICON = {
  clock: 'M12 7v5l3 2 M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  dumbbell: 'M6.5 9v6 M17.5 9v6 M4 10.5v3 M20 10.5v3 M6.5 12h11',
  series: 'M4 7h16 M4 12h16 M4 17h16',
} as const;

function StatIcon({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 text-brand"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

function StatsRow({ exercises, series, minutes }: { exercises: number; series: number; minutes: number }) {
  const items = [
    { icon: STAT_ICON.clock, value: `${minutes} min`, label: 'Duración estimada' },
    { icon: STAT_ICON.dumbbell, value: `${exercises} ejercicios`, label: 'Ejercicios' },
    { icon: STAT_ICON.series, value: `${series} series`, label: 'Series' },
  ];

  return (
    <div className="relative flex items-center gap-4 text-sm text-ink">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <StatIcon path={item.icon} />
          <MetricValue
            metric={metric(item.value, 'atlas_computed')}
            label={item.label}
            className="font-medium"
          />
        </div>
      ))}
    </div>
  );
}

function RetryableError({ message, onRetry, compact = false }: { message: string; onRetry: () => void; compact?: boolean }) {
  return (
    <div className={cn('space-y-3', compact && 'rounded-lg bg-surface/60 p-3')}>
      <ErrorState message={message} />
      <Button variant="secondary" onClick={onRetry}>{COPY.retry}</Button>
    </div>
  );
}
