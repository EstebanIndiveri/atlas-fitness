import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ExerciseNotePanel } from './ExerciseNotePanel';
import { SESSION_COPY } from '@/lib/copy/session';
import type { ExerciseSessionMemoryError } from '@/hooks/useExerciseSessionMemory';
import type {
  ExerciseSessionContext,
  WorkoutExerciseNote,
} from '@/types/exercise-session-memory';

function noteRecord(overrides: Partial<WorkoutExerciseNote> = {}): WorkoutExerciseNote {
  return {
    id: 5,
    userId: 1,
    workoutId: 1,
    exerciseId: 10,
    note: 'Subir a 42.5 kg si sale liviano.',
    version: 1,
    createdAt: '2026-09-29T10:00:00.000Z',
    updatedAt: '2026-09-29T10:05:00.000Z',
    ...overrides,
  };
}

function context(overrides: Partial<ExerciseSessionContext> = {}): ExerciseSessionContext {
  return {
    workoutId: 1,
    exerciseId: 10,
    currentNote: null,
    lastCompletedSets: null,
    lastCompletedNote: null,
    ...overrides,
  };
}

type PanelProps = React.ComponentProps<typeof ExerciseNotePanel>;

function panelProps(overrides: Partial<PanelProps> = {}): PanelProps {
  return {
    exerciseId: 10,
    exerciseName: 'Press Banca',
    readOnly: false,
    context: context(),
    loading: false,
    saving: false,
    error: null,
    onSave: jest.fn(async () => true),
    onDelete: jest.fn(async () => true),
    onRetry: jest.fn(),
    ...overrides,
  };
}

function textarea(): HTMLTextAreaElement {
  return screen.getByLabelText(
    'Nota de la sesión para Press Banca',
  ) as HTMLTextAreaElement;
}

function counterText(): string {
  return screen.getByTestId('note-counter').textContent ?? '';
}

describe('ExerciseNotePanel', () => {
  it('renders an accessible persisted note editor with explicit save', () => {
    render(<ExerciseNotePanel {...panelProps()} />);

    expect(textarea().tagName).toBe('TEXTAREA');
    expect(textarea().placeholder).toBe(SESSION_COPY.notesPlaceholder);
    expect(screen.getByRole('button', { name: SESSION_COPY.notesSave }).getAttribute('type')).toBe(
      'button',
    );
    expect(screen.queryByRole('button', { name: SESSION_COPY.notesDelete })).toBeNull();
    expect(screen.getByTestId('note-status').textContent).toBe(SESSION_COPY.notesNone);
  });

  it('shows a loading status until the context arrives', () => {
    render(<ExerciseNotePanel {...panelProps({ context: null, loading: true })} />);

    expect(screen.getByTestId('note-status').textContent).toBe(SESSION_COPY.notesLoading);
    expect(screen.getByTestId('exercise-note-input').getAttribute('readonly')).not.toBeNull();
  });

  it('omits native maxLength because code points are authoritative', () => {
    render(<ExerciseNotePanel {...panelProps()} />);
    expect(textarea().getAttribute('maxlength')).toBeNull();
  });

  it('seeds the editor verbatim from the saved current note', () => {
    render(
      <ExerciseNotePanel
        {...panelProps({ context: context({ currentNote: noteRecord() }) })}
      />,
    );

    expect(textarea().value).toBe('Subir a 42.5 kg si sale liviano.');
    expect(screen.getByTestId('note-status').textContent).toBe(SESSION_COPY.notesSaved);
    expect(screen.getByRole('button', { name: SESSION_COPY.notesDelete })).toBeTruthy();
  });

  it('saves the explicit draft through the callback', async () => {
    const onSave = jest.fn<(note: string) => Promise<boolean>>(async () => true);
    render(<ExerciseNotePanel {...panelProps({ onSave })} />);

    fireEvent.change(textarea(), { target: { value: 'Bajar a 12 reps.' } });
    fireEvent.click(screen.getByRole('button', { name: SESSION_COPY.notesSave }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith('Bajar a 12 reps.');
  });

  it('keeps the local draft when the save fails', async () => {
    const onSave = jest.fn(async () => false);
    render(<ExerciseNotePanel {...panelProps({ onSave })} />);

    fireEvent.change(textarea(), { target: { value: 'No perder este texto.' } });
    fireEvent.click(screen.getByRole('button', { name: SESSION_COPY.notesSave }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(textarea().value).toBe('No perder este texto.');
  });

  it('deletes the current note', async () => {
    const onDelete = jest.fn(async () => true);
    render(
      <ExerciseNotePanel
        {...panelProps({ context: context({ currentNote: noteRecord() }), onDelete })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: SESSION_COPY.notesDelete }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
  });

  it('shows a save/delete error and a retry for load failures', () => {
    const onRetry = jest.fn();
    const conflict: ExerciseSessionMemoryError = {
      kind: 'conflict',
      message: SESSION_COPY.notesConflict,
    };
    render(<ExerciseNotePanel {...panelProps({ error: conflict, onRetry })} />);

    expect(screen.getByText(SESSION_COPY.notesConflict)).toBeTruthy();
    expect(screen.queryByRole('button', { name: SESSION_COPY.lastTimeRetry })).toBeNull();

    render(
      <ExerciseNotePanel
        {...panelProps({
          error: { kind: 'load', message: SESSION_COPY.notesLoadError },
          onRetry,
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: SESSION_COPY.lastTimeRetry }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('counts Unicode code points and blocks 281 astral code points', () => {
    render(<ExerciseNotePanel {...panelProps()} />);
    const save = (): HTMLButtonElement =>
      screen.getByRole('button', { name: SESSION_COPY.notesSave }) as HTMLButtonElement;

    fireEvent.change(textarea(), { target: { value: '😀'.repeat(280) } });
    expect(counterText()).toBe(SESSION_COPY.notesCounter(280, 280));
    expect(save().disabled).toBe(false);
    expect(screen.queryByText(SESSION_COPY.notesTooLong(280))).toBeNull();

    fireEvent.change(textarea(), { target: { value: '😀'.repeat(281) } });
    expect(counterText()).toBe(SESSION_COPY.notesCounter(281, 280));
    expect(save().disabled).toBe(true);
    expect(screen.getByText(SESSION_COPY.notesTooLong(280))).toBeTruthy();
  });

  it('freezes the note when the session is closed', () => {
    render(
      <ExerciseNotePanel
        {...panelProps({ readOnly: true, context: context({ currentNote: noteRecord() }) })}
      />,
    );

    expect(textarea().readOnly).toBe(true);
    expect(
      (screen.getByRole('button', { name: SESSION_COPY.notesSave }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: SESSION_COPY.notesDelete }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByText(SESSION_COPY.notesReadOnly)).toBeTruthy();
  });

  it('lays out without horizontal overflow for 390px mobile', () => {
    render(<ExerciseNotePanel {...panelProps()} />);
    const root = screen.getByTestId('exercise-note-panel');
    expect(root.className).toContain('min-w-0');
    expect(textarea().className).toContain('w-full');
  });
});
