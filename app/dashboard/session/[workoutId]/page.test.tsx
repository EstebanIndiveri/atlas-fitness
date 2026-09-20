import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SESSION_COPY } from '@/lib/copy/session';

const mockPush = jest.fn();
const mockSaveAndClose = jest.fn(async () => undefined);
const mockSkipCurrent = jest.fn(async () => true);
const mockHoldCurrent = jest.fn(async () => true);

const mockSession = {
  loading: false,
  error: null,
  actionError: null as string | null,
  workout: { id: 8, endedAt: null },
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

describe('GuidedSessionPlayerPage', () => {
  afterEach(() => {
    mockPush.mockClear();
    mockSaveAndClose.mockClear();
    mockSkipCurrent.mockClear();
    mockHoldCurrent.mockClear();
  });

  it('returns to the dashboard after saving a completed session', async () => {
    mockSession.phase = 'close';
    const { default: GuidedSessionPlayerPage } = await import('./page');
    render(<GuidedSessionPlayerPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar y cerrar' }));

    await waitFor(() => expect(mockSaveAndClose).toHaveBeenCalledTimes(1));
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
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
