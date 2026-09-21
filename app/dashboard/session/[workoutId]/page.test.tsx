import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SESSION_COPY } from '@/lib/copy/session';

const mockPush = jest.fn();
const mockSaveAndClose = jest.fn(async () => undefined);
const mockSkipCurrent = jest.fn(async () => true);
const mockHoldCurrent = jest.fn(async () => true);
const mockRecordPostWorkoutFeedback = jest.fn(async (_input: unknown) => undefined);

const mockSession = {
  loading: false,
  error: null,
  actionError: null as string | null,
  workout: { id: 8, endedAt: null as string | null },
  routine: { name: 'Empuje', restSeconds: 90, exercises: [] },
  phase: 'close' as 'train' | 'close',
  summary: null,
  mood: 4,
  setMood: jest.fn(),
  saveAndClose: mockSaveAndClose,
  busy: false,
  suggestion: null,
  current: {
    exerciseId: 10,
    exerciseName: 'Press Banca',
    muscleGroup: 'Pecho',
    targetSets: 3,
    targetReps: 8,
    instructions: '',
    imageUrl: null,
    videoUrl: null,
  },
  completedCount: 1,
  weight: '40',
  setWeight: jest.fn(),
  completeSet: jest.fn(),
  skipCurrent: mockSkipCurrent,
  holdCurrent: mockHoldCurrent,
  queueItems: [
    { exerciseId: 10, name: 'Press Banca', current: true, held: false },
    { exerciseId: 20, name: 'Sentadilla', current: false, held: false },
  ],
};

jest.mock('next/navigation', () => ({
  useParams: () => ({ workoutId: '8' }),
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/hooks/useGuidedSession', () => ({
  useGuidedSession: () => mockSession,
}));

jest.mock('@/hooks/useRestTimer', () => ({
  useRestTimer: () => ({
    active: false,
    remaining: 0,
    start: jest.fn(),
    skip: jest.fn(),
  }),
}));

jest.mock('@/lib/api/post-workout-feedback', () => ({
  recordPostWorkoutFeedback: (input: unknown) => mockRecordPostWorkoutFeedback(input),
}));

describe('GuidedSessionPlayerPage', () => {
  afterEach(() => {
    mockSession.workout.endedAt = null;
    mockPush.mockClear();
    mockSaveAndClose.mockClear();
    mockSkipCurrent.mockClear();
    mockHoldCurrent.mockClear();
    mockRecordPostWorkoutFeedback.mockClear();
  });

  it('records post-workout feedback before returning to the dashboard', async () => {
    mockSession.phase = 'close';
    const { default: GuidedSessionPlayerPage } = await import('./page');
    render(<GuidedSessionPlayerPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Esfuerzo 8 de 10' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bien' }));
    fireEvent.change(screen.getByLabelText('Nota opcional'), { target: { value: 'Terminó sólido.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y cerrar' }));

    await waitFor(() => expect(mockSaveAndClose).toHaveBeenCalledTimes(1));
    expect(mockRecordPostWorkoutFeedback).toHaveBeenCalledWith({
      workoutId: 8,
      effort: 8,
      sensation: 'good',
      discomfort: [],
      note: 'Terminó sólido.',
    });
    expect(mockPush).toHaveBeenCalledWith('/dashboard/today');
  });

  it('keeps the close screen visible and shows an error when feedback cannot be saved', async () => {
    mockSession.phase = 'close';
    mockSaveAndClose.mockImplementationOnce(async () => {
      mockSession.workout.endedAt = '2026-09-20T22:00:00.000Z';
    });
    mockRecordPostWorkoutFeedback.mockRejectedValueOnce(new Error('feedback'));
    const { default: GuidedSessionPlayerPage } = await import('./page');
    const { rerender } = render(<GuidedSessionPlayerPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Esfuerzo 7 de 10' }));
    fireEvent.click(screen.getByRole('button', { name: 'Difícil' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y cerrar' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('No se pudo guardar'));
    rerender(<GuidedSessionPlayerPage />);
    expect((screen.getByRole('button', { name: 'Guardar y cerrar' }) as HTMLButtonElement).disabled).toBe(false);
    expect(mockPush).not.toHaveBeenCalled();
    mockSession.workout.endedAt = null;
  });

  it('shows skip and hold controls on the guided train screen', async () => {
    mockSession.phase = 'train';
    const { default: GuidedSessionPlayerPage } = await import('./page');
    render(<GuidedSessionPlayerPage />);

    fireEvent.click(screen.getByTestId('session-skip'));
    fireEvent.click(screen.getByTestId('session-hold'));
    await waitFor(() => expect(mockSkipCurrent).toHaveBeenCalledTimes(1));
    expect(mockHoldCurrent).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: SESSION_COPY.queueTitle })).toBeTruthy();
  });
});
