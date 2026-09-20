'use client';

import Link from 'next/link';

import { Button, buttonClassName } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { MetricValue } from '@/components/ui/MetricValue';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { UI_COPY } from '@/lib/copy/ui';
import { metric } from '@/types/metric';
import type { TodayResponse } from '@/lib/api/today';
import type { Workout } from '@/lib/db/schema';

type ActiveWorkout = Pick<Workout, 'id' | 'routineId'>;

type TrainingTodayHeroProps = {
  today: TodayResponse;
  activeWorkout: ActiveWorkout | null;
  starting: number | null;
  onStart: (routineId: number) => void;
};

/**
 * Renders the data-honest hero for the Entrenar landing.
 *
 * @param props Today union, active workout state, and start handler.
 * @returns Mobile-first hero for workout, rest, missing-routine, and no-plan states.
 * @throws Does not throw; all states are represented in the Today union.
 * @example
 * <TrainingTodayHero today={today} activeWorkout={null} starting={null} onStart={start} />
 */
export function TrainingTodayHero({
  today,
  activeWorkout,
  starting,
  onStart,
}: TrainingTodayHeroProps) {
  switch (today.kind) {
    case 'workout':
      return (
        <WorkoutHero
          today={today}
          activeWorkout={activeWorkout}
          starting={starting}
          onStart={onStart}
        />
      );
    case 'rest_day':
      return (
        <Card tone="brand" className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            {UI_COPY.training.todayEyebrow}
          </p>
          <h2 className="text-2xl font-bold text-ink">{UI_COPY.training.restTitle}</h2>
          <p className="text-sm leading-6 text-ink-muted">{UI_COPY.training.restBody}</p>
        </Card>
      );
    case 'no_plan':
      return (
        <Card>
          <EmptyState
            title={UI_COPY.training.noPlanTitle}
            description={UI_COPY.training.noPlanBody}
            action={
              <Link href="/dashboard/routines/new" className={buttonClassName()}>
                {UI_COPY.training.createRoutine}
              </Link>
            }
          />
        </Card>
      );
    case 'routine_missing':
      return (
        <Card>
          <ErrorState
            title={UI_COPY.training.missingRoutineTitle}
            message={UI_COPY.training.missingRoutineBody}
            compact={false}
          />
        </Card>
      );
  }
}

function WorkoutHero({
  today,
  activeWorkout,
  starting,
  onStart,
}: {
  today: Extract<TodayResponse, { kind: 'workout' }>;
  activeWorkout: ActiveWorkout | null;
  starting: number | null;
  onStart: (routineId: number) => void;
}) {
  const disabled = activeWorkout !== null || starting !== null;
  const activeHref =
    activeWorkout === null
      ? null
      : activeWorkout.routineId
        ? `/dashboard/session/${activeWorkout.id}`
        : `/dashboard/workout/${activeWorkout.id}`;

  return (
    <Card tone="brand" className="space-y-5 overflow-hidden rounded-xl">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            {UI_COPY.training.todayEyebrow}
          </p>
          {today.planGoal ? (
            <span
              className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-brand ring-1 ring-brand/20"
              aria-label={`${UI_COPY.training.goalLabel}: ${today.planGoal}`}
            >
              {today.planGoal}
            </span>
          ) : null}
        </div>
        <h2 className="text-3xl font-bold tracking-[-0.03em] text-ink">{today.routineName}</h2>
        <MetricValue
          metric={metric(formatCount(today.completion.total, UI_COPY.training.exerciseSingular, UI_COPY.training.exercisePlural), 'atlas_computed')}
          label={UI_COPY.training.todayExerciseCountLabel}
          className="text-sm"
        />
      </div>

      {activeHref ? (
        <Card tone="warning" elevated={false} className="space-y-3 p-3">
          <p className="text-sm text-ink">{UI_COPY.training.activeExists}</p>
          <Link
            href={activeHref}
            className={buttonClassName({ variant: 'success' })}
            data-testid="continue-active-session"
          >
            {activeWorkout?.routineId
              ? UI_COPY.training.continueGuided
              : UI_COPY.training.continueWorkout}
          </Link>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          size="lg"
          onClick={() => onStart(today.routineId)}
          disabled={disabled}
        >
          {starting === today.routineId
            ? UI_COPY.training.startingWorkout
            : UI_COPY.training.startWorkout}
        </Button>
        <Link
          href={buildAdaptHref(today)}
          className={buttonClassName({ variant: 'secondary', size: 'lg' })}
        >
          {UI_COPY.training.adaptWithCoach}
        </Link>
      </div>
      <Link href={`/dashboard/routines/${today.routineId}`} className="text-sm font-medium text-brand">
        {UI_COPY.training.viewDetails}
      </Link>
    </Card>
  );
}

function buildAdaptHref(today: Extract<TodayResponse, { kind: 'workout' }>): string {
  const params = new URLSearchParams({
    routineId: String(today.routineId),
    routineName: today.routineName,
  });
  if (today.planGoal) {
    params.set('planGoal', today.planGoal);
  }
  return `/dashboard/session/adapt?${params.toString()}`;
}

function formatCount(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}
