'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { ErrorState, LoadingState } from '@/components/ui/states';
import { getTrainingPlan } from '@/lib/api/training-plan';
import { UI_COPY } from '@/lib/copy/ui';
import type { TodayResponse } from '@/lib/api/today';
import type { CreateTrainingPlanResult, TrainingPlanDayOfWeek } from '@/lib/services/training-plan';
import type { RoutineSummary } from '@/types/routine';

type PlanState =
  | { planId: null; status: 'idle'; data: null }
  | { planId: number; status: 'loading'; data: null }
  | { planId: number; status: 'ready'; data: CreateTrainingPlanResult }
  | { planId: number; status: 'error'; data: null };

const WEEKDAY_BADGES = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'] as const;

/**
 * Renders upcoming days from the active weekly plan without fabricating metrics.
 *
 * @param props Today state and loaded routines used to resolve scheduled routine rows.
 * @returns Upcoming plan rows, loading/error state, or null when no plan exists.
 * @throws Does not throw; fetch errors render an inline error state.
 * @example
 * <UpcomingPlanSection today={today} routines={routines} />
 */
export function UpcomingPlanSection({
  today,
  routines,
}: {
  today: TodayResponse | null;
  routines: RoutineSummary[];
}) {
  const [loadedPlanState, setLoadedPlanState] = useState<PlanState>({
    planId: null,
    status: 'idle',
    data: null,
  });
  const planId = getPlanId(today);
  const planState = getPlanStateForCurrentPlan(planId, loadedPlanState);

  useEffect(() => {
    if (planId === null) {
      return;
    }

    let cancelled = false;
    getTrainingPlan(planId)
      .then((data) => {
        if (!cancelled) {
          setLoadedPlanState({ planId, status: 'ready', data });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadedPlanState({ planId, status: 'error', data: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [planId]);

  if (today === null || today.kind === 'no_plan') {
    return null;
  }

  if (planState.status === 'loading') {
    return (
      <section aria-labelledby="upcoming-days-title" className="space-y-3">
        <UpcomingHeader planId={today.trainingPlanId} />
        <LoadingState compact label="Cargando próximos días…" />
      </section>
    );
  }

  if (planState.status === 'error') {
    return (
      <section aria-labelledby="upcoming-days-title" className="space-y-3">
        <UpcomingHeader planId={today.trainingPlanId} />
        <ErrorState message="No pudimos cargar los próximos días del plan." />
      </section>
    );
  }

  if (planState.status !== 'ready') {
    return null;
  }

  const days = buildUpcomingDays(today, planState.data, routines);

  return (
    <section aria-labelledby="upcoming-days-title" className="space-y-3">
      <UpcomingHeader planId={planState.data.plan.id} />
      <div className="overflow-hidden rounded-lg bg-surface shadow-card ring-1 ring-line">
        <ul className="divide-y divide-line">
          {days.map((day) => (
            <li key={day.localDate} className="flex items-center gap-3 px-3 py-3">
              <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-canvas text-center">
                <span className="text-[10px] font-bold text-ink-muted">{day.weekday}</span>
                <span className="-mt-1 text-sm font-bold text-ink">{day.dayNumber}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">{day.title}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{day.subtitle}</p>
              </div>
              {day.kind === 'rest' ? (
                <span className="text-xl text-brand" aria-label="Día de descanso">♧</span>
              ) : day.goal ? (
                <span className="rounded-full bg-brand-muted px-3 py-1 text-[11px] font-semibold text-brand">
                  {day.goal}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function UpcomingHeader({ planId }: { planId: number | null }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2
        id="upcoming-days-title"
        className="font-serif text-xl font-semibold tracking-[-0.03em] text-ink"
      >
        Próximos días
      </h2>
      {planId !== null ? (
        <Link href={`/dashboard/plan/${planId}`} className="text-sm font-semibold text-brand">
          Ver plan completo →
        </Link>
      ) : null}
    </div>
  );
}

function buildUpcomingDays(
  today: Exclude<TodayResponse, { kind: 'no_plan' }>,
  plan: CreateTrainingPlanResult,
  routines: RoutineSummary[],
) {
  return [1, 2, 3].map((offset) => {
    const dayOfWeek = ((today.dayOfWeek + offset) % 7) as TrainingPlanDayOfWeek;
    const localDate = addLocalDateDays(today.localDate, offset);
    const scheduled = plan.schedule.find((item) => item.dayOfWeek === dayOfWeek) ?? null;
    const weekday = WEEKDAY_BADGES[dayOfWeek];
    const dayNumber = localDate.slice(8, 10);

    if (!scheduled) {
      return {
        kind: 'rest' as const,
        localDate,
        weekday,
        dayNumber,
        title: UI_COPY.training.restTitle,
        subtitle: 'Recuperación activa o reposo',
      };
    }

    const routine = routines.find((item) => item.id === scheduled.routineId) ?? null;
    return {
      kind: 'workout' as const,
      localDate,
      weekday,
      dayNumber,
      title: routine?.name ?? UI_COPY.training.missingRoutineTitle,
      subtitle: routine ? buildRoutineSubtitle(routine) : UI_COPY.training.missingRoutineBody,
      goal: scheduled.note ?? plan.plan.goal,
    };
  });
}

function getPlanId(today: TodayResponse | null): number | null {
  if (today === null || today.kind === 'no_plan') {
    return null;
  }
  return today.trainingPlanId;
}

function getPlanStateForCurrentPlan(planId: number | null, loadedPlanState: PlanState): PlanState {
  if (planId === null) {
    return { planId: null, status: 'idle', data: null };
  }
  if (loadedPlanState.planId === planId) {
    return loadedPlanState;
  }
  return { planId, status: 'loading', data: null };
}

function addLocalDateDays(localDate: string, days: number): string {
  const [year, month, day] = localDate.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return localDate;
  }
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function buildRoutineSubtitle(routine: RoutineSummary): string {
  const exerciseCount = routine.exercises.length;
  const setCount = routine.exercises.reduce((total, exercise) => total + exercise.targetSets, 0);
  return `${formatCount(exerciseCount, UI_COPY.training.exerciseSingular, UI_COPY.training.exercisePlural)} · ${formatCount(setCount, UI_COPY.training.setSingular, UI_COPY.training.setPlural)}`;
}

function formatCount(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}
