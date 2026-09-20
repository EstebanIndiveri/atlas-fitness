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
  weight: string;
  onWeightChange: (value: string) => void;
  onCompleteSet: () => void;
  busy: boolean;
};

export function GuidedExerciseCard({
  exercise,
  completedCount,
  weight,
  onWeightChange,
  onCompleteSet,
  busy,
}: GuidedExerciseCardProps) {
  const safeCompletedCount = Math.min(completedCount, exercise.targetSets);
  const setProgressPercent = exercise.targetSets > 0
    ? Math.round((safeCompletedCount / exercise.targetSets) * 100)
    : 0;

  return (
    <Card className="mb-4 overflow-hidden p-0" data-testid="guided-exercise-card">
      <div className="bg-surface px-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              {SESSION_COPY.currentExercise}
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-ink" data-testid="guided-exercise-name">
              {exercise.exerciseName}
            </h2>
          </div>
          <span className="rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-ink-muted ring-1 ring-line">
            <MetricValue
              metric={metric(SESSION_COPY.targetSets(exercise.targetSets, exercise.targetReps), 'user_input')}
              label="Objetivo de series"
            />
          </span>
        </div>
        <p className="mt-2 text-sm text-ink-muted">{exercise.muscleGroup}</p>
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs font-medium text-ink-muted">
            <MetricValue
              metric={metric(SESSION_COPY.completedSetProgress(safeCompletedCount, exercise.targetSets), 'atlas_computed')}
              label="Series completadas"
            />
            <MetricValue
              metric={metric(`${setProgressPercent}%`, 'atlas_computed')}
              label="Progreso de series"
            />
          </div>
          <div className="mt-1 h-2 rounded-full bg-canvas ring-1 ring-line">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${setProgressPercent}%` }}
            />
          </div>
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
          completedCount={completedCount}
          weight={weight}
          onWeightChange={onWeightChange}
          onCompleteSet={onCompleteSet}
          busy={busy}
        />
      </div>
    </Card>
  );
}
