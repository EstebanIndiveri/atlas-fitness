import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
const mockSaveAndClose = jest.fn(async () => undefined);

const mockSession = {
  loading: false,
  error: null,
  workout: { id: 8, endedAt: null },
  routine: { name: 'Empuje', restSeconds: 90, exercises: [] },
  phase: 'close' as const,
  summary: null,
  mood: 4,
  setMood: jest.fn(),
  saveAndClose: mockSaveAndClose,
  busy: false,
  suggestion: null,
  current: null,
  completedCount: 0,
  weight: '',
  setWeight: jest.fn(),
  completeSet: jest.fn(),
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
  it('returns to the dashboard after saving a completed session', async () => {
    const { default: GuidedSessionPlayerPage } = await import('./page');
    render(<GuidedSessionPlayerPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar y cerrar' }));

    await waitFor(() => expect(mockSaveAndClose).toHaveBeenCalledTimes(1));
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });
});
