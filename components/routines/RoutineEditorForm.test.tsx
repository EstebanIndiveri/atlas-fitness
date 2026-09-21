import { useState } from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { ROUTINE_COPY, ROUTINE_TEST_IDS } from '@/lib/copy/routines';
import { addExercise, emptyDraft, updateDraftMeta, validateDraft } from '@/lib/routines/form-state';
import { RoutineEditorForm } from './RoutineEditorForm';
import type { RoutineDraft } from '@/lib/routines/form-state';
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

function renderEditableForm(
  initialDraft: RoutineDraft,
  onMetaChange: jest.Mock<(patch: Partial<Pick<RoutineDraft, 'name' | 'description' | 'kind' | 'restSeconds'>>) => void>,
): void {
  function Harness() {
    const [draft, setDraft] = useState(initialDraft);

    return (
      <RoutineEditorForm
        mode="create"
        draft={draft}
        catalog={[bench, curl]}
        selectedExerciseId={null}
        validation={validateDraft(draft)}
        error={null}
        duplicateMessage={null}
        readOnly={false}
        busy={false}
        onMetaChange={(patch) => {
          onMetaChange(patch);
          setDraft((currentDraft) => updateDraftMeta(currentDraft, patch));
        }}
        onSelectExercise={jest.fn()}
        onAddExercise={jest.fn()}
        onUpdateExercise={jest.fn()}
        onMoveExercise={jest.fn()}
        onRemoveExercise={jest.fn()}
        onSubmit={jest.fn()}
      />
    );
  }

  render(<Harness />);
}

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

  it('leaves the rest input empty while editing after clearing the default value', () => {
    const onMetaChange = jest.fn<
      (patch: Partial<Pick<RoutineDraft, 'name' | 'description' | 'kind' | 'restSeconds'>>) => void
    >();
    renderEditableForm(emptyDraft(), onMetaChange);

    const restInput = screen.getByTestId(ROUTINE_TEST_IDS.rest) as HTMLInputElement;
    fireEvent.change(restInput, { target: { value: '' } });

    expect(restInput.value).toBe('');
    expect(onMetaChange).not.toHaveBeenCalled();
  });

  it('shows 30 rather than 030 when typing 30 after clearing the rest input', () => {
    const onMetaChange = jest.fn<
      (patch: Partial<Pick<RoutineDraft, 'name' | 'description' | 'kind' | 'restSeconds'>>) => void
    >();
    renderEditableForm(emptyDraft(), onMetaChange);

    const restInput = screen.getByTestId(ROUTINE_TEST_IDS.rest) as HTMLInputElement;
    fireEvent.change(restInput, { target: { value: '' } });
    fireEvent.change(restInput, { target: { value: '30' } });

    expect(restInput.value).toBe('30');
    expect(onMetaChange).toHaveBeenCalledTimes(1);
    expect(onMetaChange).toHaveBeenLastCalledWith({ restSeconds: 30 });
  });

  it('commits 45 without a leading zero after deleting the default rest value', () => {
    const onMetaChange = jest.fn<
      (patch: Partial<Pick<RoutineDraft, 'name' | 'description' | 'kind' | 'restSeconds'>>) => void
    >();
    renderEditableForm(emptyDraft(), onMetaChange);

    const restInput = screen.getByTestId(ROUTINE_TEST_IDS.rest) as HTMLInputElement;
    fireEvent.change(restInput, { target: { value: '' } });
    fireEvent.change(restInput, { target: { value: '45' } });

    expect(restInput.value).toBe('45');
    expect(onMetaChange).toHaveBeenCalledTimes(1);
    expect(onMetaChange).toHaveBeenLastCalledWith({ restSeconds: 45 });
  });

  it('propagates a valid committed rest value through the draft handler', () => {
    const onMetaChange = jest.fn<
      (patch: Partial<Pick<RoutineDraft, 'name' | 'description' | 'kind' | 'restSeconds'>>) => void
    >();
    renderEditableForm(emptyDraft(), onMetaChange);

    const restInput = screen.getByTestId(ROUTINE_TEST_IDS.rest) as HTMLInputElement;
    fireEvent.change(restInput, { target: { value: '030' } });

    expect(restInput.value).toBe('30');
    expect(onMetaChange).toHaveBeenLastCalledWith({ restSeconds: 30 });
  });
});
