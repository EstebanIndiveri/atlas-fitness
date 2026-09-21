import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { RoutineEditorForm } from './RoutineEditorForm';
import { ROUTINE_COPY, ROUTINE_TEST_IDS } from '@/lib/copy/routines';
import { addExercise, emptyDraft, validateDraft } from '@/lib/routines/form-state';
import type { ExerciseCatalogItem } from '@/types/exercise';

const bench: ExerciseCatalogItem = {
  id: 10,
  slug: 'bench-press',
  name: 'Press Banca',
  muscleGroup: 'Pecho',
  instructions: 'x',
  imageUrl: null,
  videoUrl: null,
  isSystem: true,
};

const curl: ExerciseCatalogItem = {
  id: 12,
  slug: 'curl',
  name: 'Curl',
  muscleGroup: 'Biceps',
  instructions: 'x',
  imageUrl: 'https://cdn.example/curl.png',
  videoUrl: null,
  isSystem: false,
};

describe('RoutineEditorForm', () => {
  it('exposes labels, empty media, locked system upload and add/remove', () => {
    const onAdd = jest.fn();
    const onRemove = jest.fn();
    const added = addExercise({ ...emptyDraft(), name: 'Empuje' }, bench, 'row-1');
    render(
      <RoutineEditorForm
        mode="create"
        draft={added.draft}
        catalog={[bench, curl]}
        selectedExerciseId={12}
        validation={validateDraft(added.draft)}
        error={null}
        duplicateMessage={null}
        readOnly={false}
        busy={false}
        onMetaChange={jest.fn()}
        onSelectExercise={jest.fn()}
        onAddExercise={onAdd}
        onUpdateExercise={jest.fn()}
        onMoveExercise={jest.fn()}
        onRemoveExercise={onRemove}
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.getByLabelText(ROUTINE_COPY.nameLabel)).toBeTruthy();
    expect(screen.getByLabelText(ROUTINE_COPY.restLabel)).toBeTruthy();
    expect(screen.getByTestId(ROUTINE_TEST_IDS.media).textContent).toBe(ROUTINE_COPY.mediaEmpty);
    const uploads = [
      screen.getByTestId(ROUTINE_TEST_IDS.uploadImage),
      screen.getByTestId(ROUTINE_TEST_IDS.uploadVideo),
    ] as HTMLInputElement[];
    expect(uploads).toHaveLength(2);
    expect(uploads.every((upload) => upload.disabled)).toBe(true);
    expect(screen.getAllByText(ROUTINE_COPY.uploadDisabled)).toHaveLength(2);

    fireEvent.click(screen.getByTestId(ROUTINE_TEST_IDS.addExercise));
    expect(onAdd).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: `${ROUTINE_COPY.remove} Press Banca` }));
    expect(onRemove).toHaveBeenCalledWith('row-1');
  });

  it('shows 404/validation copy in the form alert', () => {
    render(
      <RoutineEditorForm
        mode="edit"
        draft={emptyDraft()}
        catalog={[]}
        selectedExerciseId={null}
        validation={validateDraft(emptyDraft())}
        error={ROUTINE_COPY.notFound}
        duplicateMessage={null}
        readOnly={false}
        busy={false}
        onMetaChange={jest.fn()}
        onSelectExercise={jest.fn()}
        onAddExercise={jest.fn()}
        onUpdateExercise={jest.fn()}
        onMoveExercise={jest.fn()}
        onRemoveExercise={jest.fn()}
        onSubmit={jest.fn()}
      />,
    );
    expect(screen.getByTestId('form-error').textContent).toContain(ROUTINE_COPY.notFound);
    expect(screen.getByText(ROUTINE_COPY.errorName)).toBeTruthy();
  });
});
