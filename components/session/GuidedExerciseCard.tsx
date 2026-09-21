'use client';

import { ExerciseMedia } from '@/components/exercises/ExerciseMedia';
import { Card } from '@/components/ui/Card';
import { MetricValue } from '@/components/ui/MetricValue';
import { SetCheckList } from '@/components/session/SetCheckList';
import { SESSION_COPY } from '@/lib/copy/session';
import { metric } from '@/types/metric';
import type { RoutineExerciseItem } from '@/types/routine';

type GuidedExerciseCardProps = {
  exercise: RoutineExerciseItem;
  completedCount: number;
  completedSets?: readonly CompletedSet[];
  weight: string;
  onWeightChange: (value: string) => void;
  onCompleteSet: () => void;
  busy: boolean;
  nextExerciseName?: string | null;
};

type CompletedSet = {
  setIndex: number;
  weightKg: string;
  reps: number;
};

function ActionChip({
  children,
  ariaLabel,
}: {
  children: string;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      className="rounded-lg bg-canvas px-3 py-2 text-xs font-medium text-ink-muted"
      aria-label={ariaLabel}
      aria-pressed={false}
      disabled
    >
      {children}
    </button>
  );
}

/**
 * Active exercise card for the guided-session player.
 *
 * @param props Exercise metadata plus current-session set data and completion controls.
 * @returns A Figma-aligned exercise card without inventing unavailable prior-session data.
 * @example
 * <GuidedExerciseCard exercise={exercise} completedCount={1} weight="75" onWeightChange={() => {}} onCompleteSet={() => {}} busy={false} />
 */
export function GuidedExerciseCard({
  exercise,
  completedCount,
  completedSets = [],
  weight,
  onWeightChange,
  onCompleteSet,
  busy,
  nextExerciseName,
}: GuidedExerciseCardProps) {
  const safeCompletedCount = Math.min(completedCount, exercise.targetSets);
  const activeSet = Math.min(safeCompletedCount + 1, exercise.targetSets);

  return (
    <Card className="mb-4 overflow-hidden rounded-2xl p-0" data-testid="guided-exercise-card">
      <div className="bg-surface px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-brand-muted px-3 py-1 text-[11px] font-semibold text-brand">
            {exercise.muscleGroup}
          </span>
          <span className="text-xs font-medium text-ink-muted">
            <MetricValue
              metric={metric(SESSION_COPY.activeSetProgress(activeSet, exercise.targetSets), 'atlas_computed')}
              label="Serie actual"
            />
          </span>
        </div>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-brand" data-testid="guided-exercise-name">
          {exercise.exerciseName}
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <ActionChip ariaLabel="Técnica no disponible en esta versión">
            {SESSION_COPY.technique}
          </ActionChip>
          <ActionChip ariaLabel="Reemplazar ejercicio desde los controles de cola">
            {SESSION_COPY.replace}
          </ActionChip>
          <ActionChip ariaLabel="Notas no disponibles en esta versión">
            {SESSION_COPY.notes}
          </ActionChip>
        </div>
      </div>
      <ExerciseMedia
        name={exercise.exerciseName}
        imageUrl={exercise.imageUrl}
        videoUrl={exercise.videoUrl}
        emptyLabel={SESSION_COPY.noImage}
        videoLabel={SESSION_COPY.seeVideo}
        imageTestId="guided-exercise-image"
        videoTestId="guided-exercise-video"
        className="mt-4 px-4"
      />
      {exercise.instructions ? (
        <p className="mt-3 px-4 text-sm leading-6 text-ink">{exercise.instructions}</p>
      ) : null}
      <div className="mt-4 px-4 pb-4">
        <SetCheckList
          targetSets={exercise.targetSets}
          targetReps={exercise.targetReps}
          completedCount={completedCount}
          completedSets={completedSets}
          weight={weight}
          onWeightChange={onWeightChange}
          onCompleteSet={onCompleteSet}
          busy={busy}
          nextExerciseName={nextExerciseName}
        />
      </div>
    </Card>
  );
}
