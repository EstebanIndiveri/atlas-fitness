'use client';

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

type GuidedExerciseMediaProps = {
  name: string;
  imageUrl: string | null;
};

function resolvedImageUrl(imageUrl: string | null): string | null {
  const trimmed = imageUrl?.trim();
  return trimmed ? trimmed : null;
}

function GuidedExerciseMedia({ name, imageUrl }: GuidedExerciseMediaProps) {
  const src = resolvedImageUrl(imageUrl);
  if (src) {
    return (
      // Native img: catalog URLs are remote and may 404 in smoke; e2e only needs the region.
      <img src={src} alt={name} className="mt-3 w-full rounded-md" data-testid="guided-exercise-image" />
    );
  }

  return (
    <div
      role="img"
      aria-label={name}
      className="mt-3 flex min-h-40 w-full items-center justify-center rounded-md bg-brand-muted text-sm font-medium text-ink-muted"
      data-testid="guided-exercise-image"
    >
      {SESSION_COPY.noImage}
    </div>
  );
}

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
      <GuidedExerciseMedia name={exercise.exerciseName} imageUrl={exercise.imageUrl} />
      {exercise.videoUrl ? (
        <a
          href={exercise.videoUrl}
          className="mt-2 inline-block text-sm font-medium text-brand hover:underline"
          target="_blank"
          rel="noreferrer"
          data-testid="guided-exercise-video"
        >
          {SESSION_COPY.seeVideo}
        </a>
      ) : null}
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
