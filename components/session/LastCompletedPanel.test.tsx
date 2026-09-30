import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

import { LastCompletedPanel } from './LastCompletedPanel';
import { SESSION_COPY } from '@/lib/copy/session';
import { cordobaDisplayDate } from '@/lib/time/cordoba';
import type { ExerciseSessionMemoryError } from '@/hooks/useExerciseSessionMemory';
import type { ExerciseSessionContext } from '@/types/exercise-session-memory';

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

const lastSets = {
  workoutId: 90,
  exerciseId: 10,
  localDate: '2026-09-28',
  endedAt: '2026-09-28T12:00:00.000Z',
  sets: [
    { id: 1, exerciseId: 10, setIndex: 1, reps: 12, weightKg: '40.5' },
    { id: 3, exerciseId: 10, setIndex: 3, reps: 8, weightKg: '20.25' },
  ],
};

const lastNote = {
  workoutId: 77,
  exerciseId: 10,
  localDate: '2026-09-24',
  endedAt: '2026-09-24T12:00:00.000Z',
  noteId: 3,
  note: 'Sentí liviano; la próxima probá más peso.',
  version: 1,
};

type PanelProps = React.ComponentProps<typeof LastCompletedPanel>;

function panelProps(overrides: Partial<PanelProps> = {}): PanelProps {
  return {
    context: context(),
    loading: false,
    error: null,
    onRetry: jest.fn(),
    ...overrides,
  };
}

describe('LastCompletedPanel', () => {
  it('renders a local loading state without fake values', () => {
    render(<LastCompletedPanel {...panelProps({ context: null, loading: true })} />);

    expect(screen.getByTestId('last-time-loading').textContent).toBe(SESSION_COPY.lastTimeLoading);
    expect(screen.queryByText(SESSION_COPY.lastTimeEmpty)).toBeNull();
  });

  it('names the honest empty state when there is no previous encounter', () => {
    render(<LastCompletedPanel {...panelProps()} />);

    expect(screen.getByText(SESSION_COPY.lastTimeEmpty)).toBeTruthy();
    expect(screen.queryByText(/^\s*0/)).toBeNull();
    expect(screen.queryByTestId('last-time-set')).toBeNull();
  });

  it('shows an error with retry and never replaces it with an empty state', () => {
    const onRetry = jest.fn();
    const error: ExerciseSessionMemoryError = {
      kind: 'load',
      message: SESSION_COPY.lastTimeError,
    };
    render(<LastCompletedPanel {...panelProps({ error, onRetry })} />);

    expect(screen.getByText(SESSION_COPY.lastTimeError)).toBeTruthy();
    expect(screen.queryByText(SESSION_COPY.lastTimeEmpty)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: SESSION_COPY.lastTimeRetry }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows raw previous sets and note with their independent source dates', () => {
    render(
      <LastCompletedPanel
        {...panelProps({ context: context({ lastCompletedSets: lastSets, lastCompletedNote: lastNote }) })}
      />,
    );

    const setsDate = SESSION_COPY.lastTimeSetsDate(
      cordobaDisplayDate(new Date(lastSets.endedAt)),
    );
    const noteDate = SESSION_COPY.lastTimeNoteDate(
      cordobaDisplayDate(new Date(lastNote.endedAt)),
    );

    expect(screen.getByText(setsDate)).toBeTruthy();
    expect(screen.getByText(noteDate)).toBeTruthy();
    expect(setsDate).not.toBe(noteDate);

    expect(screen.getByText('12 reps')).toBeTruthy();
    expect(screen.getByText('40.5 kg')).toBeTruthy();
    expect(screen.getByText('20.25 kg')).toBeTruthy();
    expect(screen.getByText(lastNote.note)).toBeTruthy();
  });

  it('shows only the note date when there is no previous set encounter', () => {
    render(
      <LastCompletedPanel {...panelProps({ context: context({ lastCompletedNote: lastNote }) })} />,
    );

    expect(screen.queryByText(SESSION_COPY.lastTimeEmpty)).toBeNull();
    expect(
      screen.getByText(
        SESSION_COPY.lastTimeNoteDate(cordobaDisplayDate(new Date(lastNote.endedAt))),
      ),
    ).toBeTruthy();
    expect(screen.queryByTestId('last-time-set')).toBeNull();
  });

  it('contains no recommendation, progression or recovery language', () => {
    render(
      <LastCompletedPanel
        {...panelProps({ context: context({ lastCompletedSets: lastSets, lastCompletedNote: lastNote }) })}
      />,
    );

    const panel = screen.getByTestId('last-time-panel');
    expect(panel.textContent ?? '').not.toMatch(
      /recomend|progres|recuperaci|próxima carga|readiness|deberías|carga sugerida/i,
    );
  });
});
