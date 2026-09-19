'use client';

import { ExerciseMedia } from '@/components/exercises/ExerciseMedia';
import { Card } from '@/components/ui/Card';
import { SetCheckList } from '@/components/session/SetCheckList';
import { SESSION_COPY } from '@/lib/copy/session';
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
  return (
    <Card className="mb-4 p-4" data-testid="guided-exercise-card">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        {SESSION_COPY.currentExercise}
      </p>
      <h2 className="mt-1 text-xl font-bold text-ink" data-testid="guided-exercise-name">
        {exercise.exerciseName}
      </h2>
      <p className="text-sm text-ink-muted">
        {exercise.muscleGroup} · {SESSION_COPY.targetSets(exercise.targetSets, exercise.targetReps)}
      </p>
      <ExerciseMedia
        name={exercise.exerciseName}
        imageUrl={exercise.imageUrl}
        videoUrl={exercise.videoUrl}
        emptyLabel={SESSION_COPY.noImage}
        videoLabel={SESSION_COPY.seeVideo}
        imageTestId="guided-exercise-image"
        videoTestId="guided-exercise-video"
        className="mt-3"
      />
      {exercise.instructions ? (
        <p className="mt-3 text-sm text-ink">{exercise.instructions}</p>
      ) : null}
      <div className="mt-4">
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
