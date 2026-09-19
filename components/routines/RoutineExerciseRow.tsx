'use client';

import { ExerciseMedia } from '@/components/exercises/ExerciseMedia';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ROUTINE_COPY, ROUTINE_TEST_IDS } from '@/lib/copy/routines';
import type { DraftExercise, DraftItemErrors } from '@/lib/routines/form-state';

type RoutineExerciseRowProps = {
  exercise: DraftExercise;
  index: number;
  total: number;
  errors?: DraftItemErrors;
  readOnly: boolean;
  onChange: (
    patch: Partial<Pick<DraftExercise, 'targetSets' | 'targetReps' | 'imageUrl' | 'videoUrl'>>,
  ) => void;
  onMove: (direction: 'up' | 'down') => void;
  onRemove: () => void;
};

function parseCount(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function RoutineExerciseRow({
  exercise,
  index,
  total,
  errors,
  readOnly,
  onChange,
  onMove,
  onRemove,
}: RoutineExerciseRowProps) {
  const setsId = `routine-sets-${exercise.clientId}`;
  const repsId = `routine-reps-${exercise.clientId}`;
  const imageUrlId = `routine-image-url-${exercise.clientId}`;
  const videoUrlId = `routine-video-url-${exercise.clientId}`;
  const mediaLocked = exercise.isSystem || readOnly;

  return (
    <Card className="p-4" data-testid={ROUTINE_TEST_IDS.exerciseRow}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            {index + 1} / {total}
          </p>
          <h3 className="text-base font-semibold text-ink">{exercise.exerciseName}</h3>
          <p className="text-sm text-ink-muted">{exercise.muscleGroup}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onMove('up')}
            disabled={readOnly || index === 0}
            aria-label={`${ROUTINE_COPY.moveUp} ${exercise.exerciseName}`}
          >
            {ROUTINE_COPY.moveUp}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onMove('down')}
            disabled={readOnly || index === total - 1}
            aria-label={`${ROUTINE_COPY.moveDown} ${exercise.exerciseName}`}
          >
            {ROUTINE_COPY.moveDown}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={onRemove}
            disabled={readOnly}
            aria-label={`${ROUTINE_COPY.remove} ${exercise.exerciseName}`}
          >
            {ROUTINE_COPY.remove}
          </Button>
        </div>
      </div>

      <ExerciseMedia
        name={exercise.exerciseName}
        imageUrl={exercise.imageUrl}
        videoUrl={exercise.videoUrl}
        emptyLabel={ROUTINE_COPY.mediaEmpty}
        videoLabel={ROUTINE_COPY.seeVideo}
        videoEmptyLabel={ROUTINE_COPY.videoEmpty}
        imageTestId={ROUTINE_TEST_IDS.media}
        videoTestId={ROUTINE_TEST_IDS.video}
        showVideoEmpty
        className="mt-3"
      />

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Input
          id={setsId}
          label={ROUTINE_COPY.setsLabel}
          type="number"
          inputMode="numeric"
          min={1}
          value={exercise.targetSets}
          error={errors?.targetSets}
          disabled={readOnly}
          onChange={(event) => onChange({ targetSets: parseCount(event.target.value) })}
        />
        <Input
          id={repsId}
          label={ROUTINE_COPY.repsLabel}
          type="number"
          inputMode="numeric"
          min={1}
          value={exercise.targetReps}
          error={errors?.targetReps}
          disabled={readOnly}
          onChange={(event) => onChange({ targetReps: parseCount(event.target.value) })}
        />
      </div>

      <div className="mt-3 space-y-3">
        <Input
          id={imageUrlId}
          label={ROUTINE_COPY.imageUrlLabel}
          type="url"
          value={exercise.imageUrl ?? ''}
          hint={mediaLocked ? ROUTINE_COPY.systemMediaLocked : ROUTINE_COPY.mediaUrlHint}
          error={errors?.imageUrl}
          disabled={mediaLocked}
          data-testid={ROUTINE_TEST_IDS.imageUrl}
          onChange={(event) => onChange({ imageUrl: event.target.value || null })}
        />
        <Input
          id={videoUrlId}
          label={ROUTINE_COPY.videoUrlLabel}
          type="url"
          value={exercise.videoUrl ?? ''}
          hint={mediaLocked ? ROUTINE_COPY.systemMediaLocked : ROUTINE_COPY.mediaUrlHint}
          error={errors?.videoUrl}
          disabled={mediaLocked}
          data-testid={ROUTINE_TEST_IDS.videoUrl}
          onChange={(event) => onChange({ videoUrl: event.target.value || null })}
        />
      </div>
    </Card>
  );
}
