import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: '8' }),
  useRouter: () => ({ push: mockPush }),
}));

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, json: async () => body } as Response;
}

const workout = {
  id: 8,
  userId: 1,
  startedAt: '2026-09-24T12:00:00.000Z',
  endedAt: null,
  note: null,
  mood: null,
  deletedAt: null,
  sets: [
    {
      id: 1,
      workoutId: 8,
      exerciseId: 10,
      setIndex: 1,
      reps: 8,
      weightKg: '100',
      completed: true,
      semanticCaptureVersion: 1,
      loadMode: 'external',
      amountBasis: 'total',
      side: 'bilateral',
      setPurpose: 'working',
      repCountBasis: null,
      deletedAt: null,
    },
  ],
};

const exercises = [{ id: 10, name: 'Press Banca' }];

function fetchMock() {
  return jest.fn(async (input: Parameters<typeof fetch>[0]) => {
    const url = String(input);
    if (url === '/api/workouts/8') return jsonResponse(workout);
    if (url === '/api/exercises') return jsonResponse(exercises);
    return jsonResponse({ code: 'NOT_FOUND' }, false);
  });
}

/**
 * The legacy workout page used to fetch `/api/stats/prs` and mark a bare-weight
 * PR badge even while the workout was open. v0.12 removes all of it: an open
 * workout set is never classified as a record.
 */
describe('workout session page (legacy PR retired)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    mockPush.mockClear();
  });

  it('never requests the retired PR endpoint and shows no PR badge', async () => {
    const mock = fetchMock();
    global.fetch = mock as unknown as typeof fetch;
    const { default: WorkoutSessionPage } = await import('./page');

    render(<WorkoutSessionPage />);

    await waitFor(() => expect(screen.getByTestId('workout-set')).toBeTruthy());

    const requestedUrls = mock.mock.calls.map(([url]) => String(url));
    expect(requestedUrls).not.toContain('/api/stats/prs');
    expect(screen.queryByTestId('pr-badge')).toBeNull();
    expect(screen.queryByText('🏆 PR')).toBeNull();
  });

  it('renders the mode-aware recorded amount for a declared set', async () => {
    global.fetch = fetchMock() as unknown as typeof fetch;
    const { default: WorkoutSessionPage } = await import('./page');

    render(<WorkoutSessionPage />);

    await waitFor(() => expect(screen.getByTestId('workout-set')).toBeTruthy());

    expect(screen.getByText(/100 kg/)).toBeTruthy();
    expect(screen.queryByText('🏆 PR')).toBeNull();
  });
});
