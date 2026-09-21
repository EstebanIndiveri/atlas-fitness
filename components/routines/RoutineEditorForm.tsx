'use client';

import { useState } from 'react';
import { MediaUploadControl } from '@/components/exercises/MediaUploadControl';
import { RoutineExerciseRow } from '@/components/routines/RoutineExerciseRow';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, TextArea, fieldClassName } from '@/components/ui/Input';
import { ErrorState } from '@/components/ui/states';
import { ROUTINE_COPY, ROUTINE_TEST_IDS } from '@/lib/copy/routines';
import type { DraftValidation, RoutineDraft } from '@/lib/routines/form-state';
import type { ExerciseCatalogItem } from '@/types/exercise';
import type { RoutineKind } from '@/types/routine';

type RoutineEditorFormProps = {
  mode: 'create' | 'edit';
  draft: RoutineDraft;
  catalog: ExerciseCatalogItem[];
  selectedExerciseId: number | null;
  validation: DraftValidation;
  error: string | null;
  duplicateMessage: string | null;
  readOnly: boolean;
  busy: boolean;
  onMetaChange: (patch: Partial<Pick<RoutineDraft, 'name' | 'description' | 'kind' | 'restSeconds'>>) => void;
  onSelectExercise: (exerciseId: number | null) => void;
  onAddExercise: () => void;
  onUpdateExercise: RoutineExerciseRowUpdate;
  onMoveExercise: (clientId: string, direction: 'up' | 'down') => void;
  onRemoveExercise: (clientId: string) => void;
  onSubmit: () => void;
};

type RoutineExerciseRowUpdate = (
  clientId: string,
  patch: Partial<{ targetSets: number; targetReps: number; imageUrl: string | null; videoUrl: string | null }>,
) => void;

function parseRestInput(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function RoutineEditorForm({
  mode,
  draft,
  catalog,
  selectedExerciseId,
  validation,
  error,
  duplicateMessage,
  readOnly,
  busy,
  onMetaChange,
  onSelectExercise,
  onAddExercise,
  onUpdateExercise,
  onMoveExercise,
  onRemoveExercise,
  onSubmit,
}: RoutineEditorFormProps) {
  const title = mode === 'create' ? ROUTINE_COPY.createTitle : ROUTINE_COPY.editTitle;
  const saveLabel = mode === 'create' ? ROUTINE_COPY.saveCreate : ROUTINE_COPY.saveEdit;
  const unusedCatalog = catalog.filter(
    (item) => !draft.exercises.some((exercise) => exercise.exerciseId === item.id),
  );
  const [restInputValue, setRestInputValue] = useState(() => String(draft.restSeconds));
  const [syncedRestSeconds, setSyncedRestSeconds] = useState(draft.restSeconds);

  // Reconcile the local editable string with external draft changes during
  // render (React-recommended pattern) instead of an effect, so parent-driven
  // rest updates stay in sync without cascading renders.
  if (draft.restSeconds !== syncedRestSeconds) {
    setSyncedRestSeconds(draft.restSeconds);
    setRestInputValue(String(draft.restSeconds));
  }

  return (
    <form
      className="space-y-4"
      data-testid={ROUTINE_TEST_IDS.form}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <h1 className="text-title font-bold text-ink">{readOnly ? ROUTINE_COPY.viewTitle : title}</h1>

      {readOnly ? (
        <Card tone="warning" className="p-4" data-testid={ROUTINE_TEST_IDS.readOnly}>
          <p className="text-sm text-ink">{ROUTINE_COPY.readOnlyBanner}</p>
        </Card>
      ) : null}

      {error ? <ErrorState message={error} /> : null}

      <Input
        id="routine-name"
        label={ROUTINE_COPY.nameLabel}
        value={draft.name}
        error={validation.name}
        disabled={readOnly}
        required
        data-testid={ROUTINE_TEST_IDS.name}
        onChange={(event) => onMetaChange({ name: event.target.value })}
      />

      <TextArea
        id="routine-description"
        label={ROUTINE_COPY.descriptionLabel}
        rows={3}
        value={draft.description}
        disabled={readOnly}
        data-testid={ROUTINE_TEST_IDS.description}
        onChange={(event) => onMetaChange({ description: event.target.value })}
      />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink">{ROUTINE_COPY.kindLabel}</legend>
        <div className="flex flex-wrap gap-4">
          <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
            <input
              type="radio"
              name="routine-kind"
              value="gym"
              checked={draft.kind === 'gym'}
              disabled={readOnly}
              data-testid={ROUTINE_TEST_IDS.kindGym}
              onChange={() => onMetaChange({ kind: 'gym' as RoutineKind })}
            />
            {ROUTINE_COPY.kindGym}
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
            <input
              type="radio"
              name="routine-kind"
              value="home"
              checked={draft.kind === 'home'}
              disabled={readOnly}
              data-testid={ROUTINE_TEST_IDS.kindHome}
              onChange={() => onMetaChange({ kind: 'home' as RoutineKind })}
            />
            {ROUTINE_COPY.kindHome}
          </label>
        </div>
      </fieldset>

      <Input
        id="routine-rest"
        label={ROUTINE_COPY.restLabel}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        hint={ROUTINE_COPY.restHint}
        value={restInputValue}
        error={validation.restSeconds}
        disabled={readOnly}
        data-testid={ROUTINE_TEST_IDS.rest}
        onBlur={() => {
          if (parseRestInput(restInputValue) === null) {
            setRestInputValue(String(draft.restSeconds));
          }
        }}
        onChange={(event) => {
          const nextValue = event.target.value;
          const parsed = parseRestInput(nextValue);
          if (parsed === null) {
            setRestInputValue(nextValue);
            return;
          }
          setRestInputValue(String(parsed));
          onMetaChange({ restSeconds: parsed });
        }}
      />

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-ink">{ROUTINE_COPY.exercisesLegend}</legend>
        {validation.exercises ? (
          <p className="text-sm text-danger" role="alert">
            {validation.exercises}
          </p>
        ) : null}
        {duplicateMessage ? (
          <p className="text-sm text-danger" role="alert">
            {duplicateMessage}
          </p>
        ) : null}

        {draft.exercises.length === 0 ? (
          <p className="text-sm text-ink-muted" data-testid={ROUTINE_TEST_IDS.empty}>
            {ROUTINE_COPY.emptyExercises}
          </p>
        ) : (
          <div className="space-y-3">
            {draft.exercises.map((exercise, index) => {
              const mediaLocked = readOnly || exercise.isSystem;
              return (
                <div key={exercise.clientId} className="space-y-3">
                  <RoutineExerciseRow
                    exercise={exercise}
                    index={index}
                    total={draft.exercises.length}
                    errors={validation.items[exercise.clientId]}
                    readOnly={readOnly}
                    onChange={(patch) => onUpdateExercise(exercise.clientId, patch)}
                    onMove={(direction) => onMoveExercise(exercise.clientId, direction)}
                    onRemove={() => onRemoveExercise(exercise.clientId)}
                  />
                  <div className="grid gap-3 rounded-md border border-line bg-surface p-3 sm:grid-cols-2">
                    <MediaUploadControl
                      mediaType="image"
                      disabled={mediaLocked}
                      testId={ROUTINE_TEST_IDS.uploadImage}
                      onUploaded={(url) => onUpdateExercise(exercise.clientId, { imageUrl: url })}
                    />
                    <MediaUploadControl
                      mediaType="video"
                      disabled={mediaLocked}
                      testId={ROUTINE_TEST_IDS.uploadVideo}
                      onUploaded={(url) => onUpdateExercise(exercise.clientId, { videoUrl: url })}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="routine-catalog" className="mb-1 block text-sm font-medium text-ink">
              {ROUTINE_COPY.catalogLabel}
            </label>
            <select
              id="routine-catalog"
              className={fieldClassName()}
              value={selectedExerciseId ?? ''}
              disabled={readOnly || unusedCatalog.length === 0}
              data-testid={ROUTINE_TEST_IDS.catalog}
              onChange={(event) =>
                onSelectExercise(event.target.value ? Number(event.target.value) : null)
              }
            >
              <option value="">{ROUTINE_COPY.addExerciseLabel}</option>
              {unusedCatalog.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={readOnly || selectedExerciseId === null}
            data-testid={ROUTINE_TEST_IDS.addExercise}
            onClick={onAddExercise}
          >
            {ROUTINE_COPY.addExercise}
          </Button>
        </div>
      </fieldset>

      <Button type="submit" size="lg" disabled={readOnly || busy} data-testid={ROUTINE_TEST_IDS.save}>
        {busy ? ROUTINE_COPY.saving : saveLabel}
      </Button>
    </form>
  );
}
