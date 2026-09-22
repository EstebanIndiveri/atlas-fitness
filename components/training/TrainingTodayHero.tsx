'use client';

import Link from 'next/link';

import { Button, buttonClassName } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { UI_COPY } from '@/lib/copy/ui';
import type { TodayResponse } from '@/lib/api/today';
import type { Workout } from '@/lib/db/schema';
import type { RoutineSummary } from '@/types/routine';

type ActiveWorkout = Pick<Workout, 'id' | 'routineId'>;

type TrainingTodayHeroProps = {
  today: TodayResponse;
  routines: RoutineSummary[];
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
  routines,
  activeWorkout,
  starting,
  onStart,
}: TrainingTodayHeroProps) {
  switch (today.kind) {
    case 'workout':
      return (
        <WorkoutHero
          today={today}
          routines={routines}
          activeWorkout={activeWorkout}
          starting={starting}
          onStart={onStart}
        />
      );
    case 'rest_day':
      return <RestCard />;
    case 'no_plan':
      return <NoPlanCard />;
    case 'routine_missing':
      return <MissingRoutineCard />;
  }
}

function WorkoutHero({
  today,
  routines,
  activeWorkout,
  starting,
  onStart,
}: {
  today: Extract<TodayResponse, { kind: 'workout' }>;
  routines: RoutineSummary[];
  activeWorkout: ActiveWorkout | null;
  starting: number | null;
  onStart: (routineId: number) => void;
}) {
  const disabled = activeWorkout !== null || starting !== null;
  const routine = routines.find((item) => item.id === today.routineId) ?? null;
  const exerciseCount = routine?.exercises.length ?? null;
  const setCount = routine?.exercises.reduce((total, exercise) => total + exercise.targetSets, 0) ?? null;
  const activeHref =
    activeWorkout === null
      ? null
      : activeWorkout.routineId
        ? `/dashboard/session/${activeWorkout.id}`
        : `/dashboard/workout/${activeWorkout.id}`;

  return (
    <Card
      tone="brand"
      className="space-y-5 overflow-hidden rounded-2xl border border-brand/10 bg-[linear-gradient(160deg,rgba(236,247,238,0.95),rgba(248,250,246,0.88))]"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="rounded-full bg-surface/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-brand ring-1 ring-brand/10">
            ● HOY · EN TU PLAN
          </p>
          {today.planGoal ? (
            <span
              className="rounded-full bg-brand-muted px-3 py-1 text-xs font-semibold text-brand ring-1 ring-brand/15"
              aria-label={`${UI_COPY.training.goalLabel}: ${today.planGoal}`}
            >
              {today.planGoal}
            </span>
          ) : null}
        </div>
        <div>
          <h2 className="font-serif text-3xl font-semibold leading-tight tracking-[-0.04em] text-ink">
            {today.routineName}
          </h2>
          {today.dayReason ? (
            <p className="mt-2 text-sm leading-6 text-ink-muted">{today.dayReason}</p>
          ) : null}
        </div>
        {exerciseCount !== null ? (
          <div className="flex flex-wrap gap-2 text-xs font-medium text-ink">
            <MetricPill
              icon="↗"
              label={formatCount(
                exerciseCount,
                UI_COPY.training.exerciseSingular,
                UI_COPY.training.exercisePlural,
              )}
            />
            {setCount !== null ? (
              <MetricPill
                icon="⇄"
                label={formatCount(setCount, UI_COPY.training.setSingular, UI_COPY.training.setPlural)}
              />
            ) : null}
          </div>
        ) : null}
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
          className="rounded-xl bg-brand py-4"
        >
          {starting === today.routineId
            ? UI_COPY.training.startingWorkout
            : `${UI_COPY.training.startWorkout} ▶`}
        </Button>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-brand/10 pt-1 text-sm">
        <Link
          href={buildAdaptHref(today)}
          className="font-semibold text-brand"
          aria-label={UI_COPY.training.adaptWithCoach}
        >
          <span aria-hidden="true">✦ </span>
          {UI_COPY.training.adaptWithCoach}
        </Link>
        <Link href={`/dashboard/routines/${today.routineId}`} className="font-medium text-ink-muted">
          {UI_COPY.training.viewDetails}
        </Link>
      </div>
    </Card>
  );
}

function MetricPill({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/75 px-3 py-1.5 ring-1 ring-line/70">
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </span>
  );
}

function RestCard() {
  return (
    <Card tone="brand" className="space-y-2 rounded-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
        {UI_COPY.training.todayEyebrow}
      </p>
      <h2 className="font-serif text-2xl font-semibold text-ink">{UI_COPY.training.restTitle}</h2>
      <p className="text-sm leading-6 text-ink-muted">{UI_COPY.training.restBody}</p>
    </Card>
  );
}

function NoPlanCard() {
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
}

function MissingRoutineCard() {
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
