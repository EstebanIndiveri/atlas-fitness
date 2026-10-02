import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SESSION_COPY } from '@/lib/copy/session';
import { PROGRESSION_COPY } from '@/lib/copy/exercise-progression';
import { resetPrEventGuardForTests } from '@/lib/session/pr-event-guard';
import type { ExerciseProgression, ProgressionSourceSet } from '@/types/progression-read';

const mockPush = jest.fn();
const mockSaveAndClose = jest.fn<() => Promise<unknown>>(async () => undefined);
const mockSkipCurrent = jest.fn(async () => true);
const mockHoldCurrent = jest.fn(async () => true);
const mockRecordPostWorkoutFeedback = jest.fn(async (_input: unknown) => undefined);
const mockFetchProgression = jest.fn<
  (exerciseId: number, cohort: unknown) => Promise<ExerciseProgression>
>();
const mockRestStart = jest.fn();
const mockRestSkip = jest.fn();
const mockRestTimer = {
  active: false,
  remaining: 0,
  start: mockRestStart,
  skip: mockRestSkip,
};

const mockSession = {
  loading: false,
  error: null,
  actionError: null as string | null,
  workout: {
    id: 8,
    endedAt: null as string | null,
    startedAt: '2026-09-20T22:00:00.000Z',
    sets: [{ exerciseId: 10, setIndex: 1, reps: 10, weightKg: '70.0' }],
  },
  routine: {
    name: 'Empuje',
    restSeconds: 90,
    exercises: [
      {
        exerciseId: 10,
        exerciseName: 'Press Banca',
        muscleGroup: 'Pecho',
        targetSets: 3,
        targetReps: 8,
        instructions: '',
        imageUrl: null,
        videoUrl: null,
      },
      {
        exerciseId: 20,
        exerciseName: 'Sentadilla',
        muscleGroup: 'Piernas',
        targetSets: 3,
        targetReps: 8,
        instructions: '',
        imageUrl: null,
        videoUrl: null,
      },
    ],
  },
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
  reps: '8',
  setReps: jest.fn(),
  semanticDraft: {
    loadMode: 'external',
    amountBasis: 'total',
    side: 'bilateral',
    setPurpose: 'working',
    repCountBasis: '',
  },
  semantics: {
    draft: {
      loadMode: 'external',
      amountBasis: 'total',
      side: 'bilateral',
      setPurpose: 'working',
      repCountBasis: '',
    },
    reused: false,
    onLoadMode: jest.fn(),
    onAmountBasis: jest.fn(),
    onSide: jest.fn(),
    onSetPurpose: jest.fn(),
    onRepCountBasis: jest.fn(),
  },
  addSet: jest.fn(),
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
  useRestTimer: () => mockRestTimer,
}));

jest.mock('@/lib/api/post-workout-feedback', () => ({
  recordPostWorkoutFeedback: (input: unknown) => mockRecordPostWorkoutFeedback(input),
}));

jest.mock('@/lib/api/exercise-progression', () => ({
  fetchExerciseProgression: (exerciseId: number, cohort: unknown) =>
    mockFetchProgression(exerciseId, cohort),
}));

const SEMANTICS = {
  semanticCaptureVersion: 1,
  loadMode: 'external' as const,
  amountBasis: 'total' as const,
  side: 'bilateral' as const,
  setPurpose: 'working' as const,
  repCountBasis: null,
};

function sourceSet(overrides: Partial<ProgressionSourceSet> = {}): ProgressionSourceSet {
  return {
    setId: 101,
    workoutId: 8,
    setIndex: 1,
    reps: 8,
    weightKg: '70.0',
    endedAt: '2026-09-20T22:00:00.000Z',
    localDate: '2026-09-20',
    semantics: SEMANTICS,
    provenance: 'user_input',
    ...overrides,
  };
}

function progression(overrides: Partial<ExerciseProgression> = {}): ExerciseProgression {
  return {
    metricId: 'same_reps_external_load',
    progressionRuleVersion: 1,
    readStatus: 'ready',
    cohort: {
      exerciseId: 10,
      loadMode: 'external',
      amountBasis: 'total',
      side: 'bilateral',
      reps: 8,
    },
    currentRepresentative: sourceSet(),
    previousComparableRepresentative: sourceSet({ setId: 60, workoutId: 7, weightKg: '65' }),
    currentBest: sourceSet(),
    comparison: 'new_pr',
    reasons: ['eligible'],
    history: { items: [], nextCursor: null, limit: 10, bounded: true },
    provenance: 'atlas_computed',
    ...overrides,
  };
}

const PR_KEY = '1:same_reps_external_load:10:8:total:bilateral:101';

function closedSet(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    workoutId: 8,
    exerciseId: 10,
    setIndex: 1,
    reps: 8,
    weightKg: '70.0',
    completed: true,
    deletedAt: null,
    semanticCaptureVersion: 1,
    loadMode: 'external',
    amountBasis: 'total',
    side: 'bilateral',
    setPurpose: 'working',
    repCountBasis: null,
    ...overrides,
  };
}

function closedWorkout(
  sets: ReturnType<typeof closedSet>[] = [closedSet()],
  overrides: Record<string, unknown> = {},
) {
  return { id: 8, routineId: 1, endedAt: '2026-09-20T22:00:00.000Z', sets, ...overrides };
}

describe('GuidedSessionPlayerPage', () => {
  afterEach(() => {
    mockSession.workout.endedAt = null;
    mockSession.phase = 'close';
    mockPush.mockClear();
    mockSaveAndClose.mockReset();
    mockSaveAndClose.mockImplementation(async () => undefined);
    mockSkipCurrent.mockClear();
    mockHoldCurrent.mockClear();
    mockRecordPostWorkoutFeedback.mockReset();
    mockRecordPostWorkoutFeedback.mockImplementation(async () => undefined);
    mockFetchProgression.mockReset();
    mockRestStart.mockClear();
    mockRestSkip.mockClear();
    mockRestTimer.active = false;
    mockRestTimer.remaining = 0;
    resetPrEventGuardForTests();
    window.sessionStorage.clear();
  });

  it('records post-workout feedback before returning to the dashboard', async () => {
    mockSession.phase = 'close';
    const { default: GuidedSessionPlayerPage } = await import('./page');
    render(<GuidedSessionPlayerPage />);

    fireEvent.click(screen.getByTestId('close-effort-exigente'));
    fireEvent.click(screen.getByTestId('close-mood-good'));
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar y guardar' }));

    await waitFor(() => expect(mockSaveAndClose).toHaveBeenCalledTimes(1));
    expect(mockRecordPostWorkoutFeedback).toHaveBeenCalledWith({
      workoutId: 8,
      effort: 9,
      sensation: 'good',
      discomfort: [],
      note: null,
    });
    expect(mockPush).toHaveBeenCalledWith('/dashboard/today');
  });

  it('keeps the close screen visible, factually closed, and shows an error when feedback cannot be saved', async () => {
    mockSession.phase = 'close';
    mockSaveAndClose.mockImplementationOnce(async () => {
      mockSession.workout.endedAt = '2026-09-20T22:00:00.000Z';
    });
    mockRecordPostWorkoutFeedback.mockRejectedValueOnce(new Error('feedback'));
    const { default: GuidedSessionPlayerPage } = await import('./page');
    const { rerender } = render(<GuidedSessionPlayerPage />);

    fireEvent.click(screen.getByTestId('close-effort-normal'));
    fireEvent.click(screen.getByTestId('close-mood-bad'));
    fireEvent.click(screen.getByTestId('close-save'));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('No se pudo guardar'));
    rerender(<GuidedSessionPlayerPage />);
    expect((screen.getByTestId('close-save') as HTMLButtonElement).disabled).toBe(false);
    // The workout is persisted as closed; feedback failure must not reopen it.
    expect(screen.getByTestId('session-close').getAttribute('data-closed')).toBe('true');
    expect(screen.getByTestId('close-save').textContent).toBe(SESSION_COPY.saveFeedback);
    expect(screen.queryByTestId('verified-pr-celebration')).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
    mockSession.workout.endedAt = null;
  });

  it('does not celebrate merely because the close screen is shown for an open workout', async () => {
    mockSession.phase = 'close';
    const { default: GuidedSessionPlayerPage } = await import('./page');
    render(<GuidedSessionPlayerPage />);

    expect(screen.getByTestId('session-close')).toBeTruthy();
    expect(screen.queryByTestId('verified-pr-celebration')).toBeNull();
    expect(mockFetchProgression).not.toHaveBeenCalled();
  });

  it('never celebrates or verifies on mounting an already-closed workout', async () => {
    mockSession.phase = 'close';
    mockSession.workout.endedAt = '2026-09-20T22:00:00.000Z';
    const { default: GuidedSessionPlayerPage } = await import('./page');
    render(<GuidedSessionPlayerPage />);

    expect(screen.getByTestId('session-close').getAttribute('data-closed')).toBe('true');
    expect(screen.queryByTestId('verified-pr-celebration')).toBeNull();
    expect(mockFetchProgression).not.toHaveBeenCalled();
    mockSession.workout.endedAt = null;
  });

  it('does not celebrate when the close PATCH fails', async () => {
    mockSession.phase = 'close';
    mockSaveAndClose.mockRejectedValueOnce(new Error('end'));
    const { default: GuidedSessionPlayerPage } = await import('./page');
    render(<GuidedSessionPlayerPage />);

    fireEvent.click(screen.getByTestId('close-effort-exigente'));
    fireEvent.click(screen.getByTestId('close-mood-good'));
    fireEvent.click(screen.getByTestId('close-save'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.queryByTestId('verified-pr-celebration')).toBeNull();
    expect(mockFetchProgression).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not celebrate a baseline result and keeps the normal navigation', async () => {
    mockSession.phase = 'close';
    mockSaveAndClose.mockResolvedValueOnce(closedWorkout());
    mockFetchProgression.mockResolvedValueOnce(progression({ comparison: 'baseline' }));
    const { default: GuidedSessionPlayerPage } = await import('./page');
    render(<GuidedSessionPlayerPage />);

    fireEvent.click(screen.getByTestId('close-effort-exigente'));
    fireEvent.click(screen.getByTestId('close-mood-good'));
    fireEvent.click(screen.getByTestId('close-save'));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/today'));
    expect(screen.queryByTestId('verified-pr-celebration')).toBeNull();
  });

  it('celebrates exactly once for a PR verified on this exact closed workout and set', async () => {
    mockSession.phase = 'close';
    mockSaveAndClose.mockResolvedValueOnce(closedWorkout());
    mockFetchProgression.mockResolvedValueOnce(progression());
    const { default: GuidedSessionPlayerPage } = await import('./page');
    render(<GuidedSessionPlayerPage />);

    fireEvent.click(screen.getByTestId('close-effort-exigente'));
    fireEvent.click(screen.getByTestId('close-mood-good'));
    fireEvent.click(screen.getByTestId('close-save'));

    const celebration = await screen.findByTestId('verified-pr-celebration');
    expect(celebration.getAttribute('data-icon')).toBe('verified');
    expect(screen.getByTestId('verified-pr-title').textContent).toBe(
      PROGRESSION_COPY.comparison.new_pr,
    );
    expect(mockPush).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('verified-pr-continue'));
    expect(mockPush).toHaveBeenCalledWith('/dashboard/today');
  });

  it.each(['baseline', 'ties_best', 'below_best'] as const)(
    'does not celebrate %s',
    async (comparison) => {
      mockSession.phase = 'close';
      mockSaveAndClose.mockResolvedValueOnce(closedWorkout());
      mockFetchProgression.mockResolvedValueOnce(progression({ comparison }));
      const { default: GuidedSessionPlayerPage } = await import('./page');
      render(<GuidedSessionPlayerPage />);

      fireEvent.click(screen.getByTestId('close-effort-exigente'));
      fireEvent.click(screen.getByTestId('close-mood-good'));
      fireEvent.click(screen.getByTestId('close-save'));

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/today'));
      expect(screen.queryByTestId('verified-pr-celebration')).toBeNull();
    },
  );

  it('does not celebrate when the read model has no history', async () => {
    mockSession.phase = 'close';
    mockSaveAndClose.mockResolvedValueOnce(closedWorkout());
    mockFetchProgression.mockResolvedValueOnce(
      progression({ readStatus: 'no_history', comparison: null, currentRepresentative: null }),
    );
    const { default: GuidedSessionPlayerPage } = await import('./page');
    render(<GuidedSessionPlayerPage />);

    fireEvent.click(screen.getByTestId('close-effort-exigente'));
    fireEvent.click(screen.getByTestId('close-mood-good'));
    fireEvent.click(screen.getByTestId('close-save'));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/today'));
    expect(screen.queryByTestId('verified-pr-celebration')).toBeNull();
  });

  it('does not celebrate when the representative belongs to another workout', async () => {
    mockSession.phase = 'close';
    mockSaveAndClose.mockResolvedValueOnce(closedWorkout());
    mockFetchProgression.mockResolvedValueOnce(
      progression({ currentRepresentative: sourceSet({ setId: 101, workoutId: 999 }) }),
    );
    const { default: GuidedSessionPlayerPage } = await import('./page');
    render(<GuidedSessionPlayerPage />);

    fireEvent.click(screen.getByTestId('close-effort-exigente'));
    fireEvent.click(screen.getByTestId('close-mood-good'));
    fireEvent.click(screen.getByTestId('close-save'));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/today'));
    expect(screen.queryByTestId('verified-pr-celebration')).toBeNull();
  });

  it('does not celebrate when the representative set is not in the closed workout', async () => {
    mockSession.phase = 'close';
    mockSaveAndClose.mockResolvedValueOnce(closedWorkout());
    mockFetchProgression.mockResolvedValueOnce(
      progression({ currentRepresentative: sourceSet({ setId: 555, workoutId: 8 }) }),
    );
    const { default: GuidedSessionPlayerPage } = await import('./page');
    render(<GuidedSessionPlayerPage />);

    fireEvent.click(screen.getByTestId('close-effort-exigente'));
    fireEvent.click(screen.getByTestId('close-mood-good'));
    fireEvent.click(screen.getByTestId('close-save'));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/today'));
    expect(screen.queryByTestId('verified-pr-celebration')).toBeNull();
  });

  it('does not query unsupported cohorts from the closed workout', async () => {
    mockSession.phase = 'close';
    mockSaveAndClose.mockResolvedValueOnce(
      closedWorkout([closedSet({ loadMode: 'bodyweight', amountBasis: null })]),
    );
    const { default: GuidedSessionPlayerPage } = await import('./page');
    render(<GuidedSessionPlayerPage />);

    fireEvent.click(screen.getByTestId('close-effort-exigente'));
    fireEvent.click(screen.getByTestId('close-mood-good'));
    fireEvent.click(screen.getByTestId('close-save'));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/today'));
    expect(mockFetchProgression).not.toHaveBeenCalled();
    expect(screen.queryByTestId('verified-pr-celebration')).toBeNull();
  });

  it('queries duplicate sets of the same cohort only once', async () => {
    mockSession.phase = 'close';
    mockSaveAndClose.mockResolvedValueOnce(
      closedWorkout([
        closedSet({ id: 101, setIndex: 1 }),
        closedSet({ id: 102, setIndex: 2 }),
      ]),
    );
    mockFetchProgression.mockResolvedValueOnce(
      progression({ comparison: 'below_best' }),
    );
    const { default: GuidedSessionPlayerPage } = await import('./page');
    render(<GuidedSessionPlayerPage />);

    fireEvent.click(screen.getByTestId('close-effort-exigente'));
    fireEvent.click(screen.getByTestId('close-mood-good'));
    fireEvent.click(screen.getByTestId('close-save'));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/today'));
    expect(mockFetchProgression).toHaveBeenCalledTimes(1);
  });

  it('shows at most one animated celebration for multiple verified PR cohorts', async () => {
    mockSession.phase = 'close';
    mockSaveAndClose.mockResolvedValueOnce(
      closedWorkout([
        closedSet({ id: 101, exerciseId: 10, setIndex: 1, reps: 8 }),
        closedSet({ id: 102, exerciseId: 20, setIndex: 2, reps: 5 }),
      ]),
    );
    mockFetchProgression.mockImplementation(async (exerciseId: number) => {
      if (exerciseId === 20) {
        return progression({
          cohort: { exerciseId: 20, loadMode: 'external', amountBasis: 'total', side: 'bilateral', reps: 5 },
          currentRepresentative: sourceSet({ setId: 102, workoutId: 8, reps: 5 }),
        });
      }
      return progression({ comparison: 'baseline' });
    });
    const { default: GuidedSessionPlayerPage } = await import('./page');
    render(<GuidedSessionPlayerPage />);

    fireEvent.click(screen.getByTestId('close-effort-exigente'));
    fireEvent.click(screen.getByTestId('close-mood-good'));
    fireEvent.click(screen.getByTestId('close-save'));

    await screen.findByTestId('verified-pr-celebration');
    expect(screen.getAllByTestId('verified-pr-celebration')).toHaveLength(1);
    // Deterministic routine/set order: first candidate baseline, second verifies.
    expect(mockFetchProgression).toHaveBeenCalledTimes(2);
    expect(mockFetchProgression.mock.calls[0][0]).toBe(10);
    expect(mockFetchProgression.mock.calls[1][0]).toBe(20);
    expect(screen.getByTestId('verified-pr-source').textContent).toContain('5 reps');
  });

  it('does not replay the same event already seen in memory', async () => {
    mockSession.phase = 'close';
    mockSaveAndClose.mockResolvedValue(closedWorkout());
    mockFetchProgression.mockResolvedValue(progression());
    const { default: GuidedSessionPlayerPage } = await import('./page');
    const first = render(<GuidedSessionPlayerPage />);

    fireEvent.click(screen.getByTestId('close-effort-exigente'));
    fireEvent.click(screen.getByTestId('close-mood-good'));
    fireEvent.click(screen.getByTestId('close-save'));
    await screen.findByTestId('verified-pr-celebration');

    first.unmount();
    mockSession.workout.endedAt = null;
    mockPush.mockClear();
    render(<GuidedSessionPlayerPage />);

    fireEvent.click(screen.getByTestId('close-effort-exigente'));
    fireEvent.click(screen.getByTestId('close-mood-good'));
    fireEvent.click(screen.getByTestId('close-save'));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/today'));
    expect(screen.queryByTestId('verified-pr-celebration')).toBeNull();
  });

  it('does not replay the same event already seen in sessionStorage', async () => {
    mockSession.phase = 'close';
    window.sessionStorage.setItem(`atlas:verified-pr:${PR_KEY}`, '1');
    mockSaveAndClose.mockResolvedValueOnce(closedWorkout());
    mockFetchProgression.mockResolvedValueOnce(progression());
    const { default: GuidedSessionPlayerPage } = await import('./page');
    render(<GuidedSessionPlayerPage />);

    fireEvent.click(screen.getByTestId('close-effort-exigente'));
    fireEvent.click(screen.getByTestId('close-mood-good'));
    fireEvent.click(screen.getByTestId('close-save'));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/today'));
    expect(screen.queryByTestId('verified-pr-celebration')).toBeNull();
  });

  it('degrades safely when sessionStorage is unavailable', async () => {
    mockSession.phase = 'close';
    const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() {
        throw new Error('storage disabled');
      },
    });
    mockSaveAndClose.mockResolvedValueOnce(closedWorkout());
    mockFetchProgression.mockResolvedValueOnce(progression());

    try {
      const { default: GuidedSessionPlayerPage } = await import('./page');
      render(<GuidedSessionPlayerPage />);

      fireEvent.click(screen.getByTestId('close-effort-exigente'));
      fireEvent.click(screen.getByTestId('close-mood-good'));
      fireEvent.click(screen.getByTestId('close-save'));

      expect(await screen.findByTestId('verified-pr-celebration')).toBeTruthy();
    } finally {
      if (original) {
        Object.defineProperty(window, 'sessionStorage', original);
      }
    }
  });

  it('keeps the close successful and omits the celebration on verification timeout', async () => {
    mockSession.phase = 'close';
    mockSaveAndClose.mockResolvedValueOnce(closedWorkout());
    mockFetchProgression.mockImplementationOnce(() => new Promise<ExerciseProgression>(() => {}));
    const { default: GuidedSessionPlayerPage } = await import('./page');
    render(<GuidedSessionPlayerPage />);

    fireEvent.click(screen.getByTestId('close-effort-exigente'));
    fireEvent.click(screen.getByTestId('close-mood-good'));
    fireEvent.click(screen.getByTestId('close-save'));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/today'), {
      timeout: 4000,
    });
    expect(screen.queryByTestId('verified-pr-celebration')).toBeNull();
  }, 10000);

  it('keeps the close successful and omits the celebration on a verification network error', async () => {
    mockSession.phase = 'close';
    mockSaveAndClose.mockResolvedValueOnce(closedWorkout());
    mockFetchProgression.mockRejectedValueOnce(new Error('network'));
    const { default: GuidedSessionPlayerPage } = await import('./page');
    render(<GuidedSessionPlayerPage />);

    fireEvent.click(screen.getByTestId('close-effort-exigente'));
    fireEvent.click(screen.getByTestId('close-mood-good'));
    fireEvent.click(screen.getByTestId('close-save'));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/today'));
    expect(mockRecordPostWorkoutFeedback).toHaveBeenCalled();
    expect(screen.queryByTestId('verified-pr-celebration')).toBeNull();
  });

  it('does not fire a second celebration when feedback is retried after a failure', async () => {
    mockSession.phase = 'close';
    mockSaveAndClose.mockImplementationOnce(async () => {
      mockSession.workout.endedAt = '2026-09-20T22:00:00.000Z';
      return closedWorkout();
    });
    mockFetchProgression.mockResolvedValue(progression());
    mockRecordPostWorkoutFeedback.mockRejectedValueOnce(new Error('feedback'));
    const { default: GuidedSessionPlayerPage } = await import('./page');
    render(<GuidedSessionPlayerPage />);

    fireEvent.click(screen.getByTestId('close-effort-exigente'));
    fireEvent.click(screen.getByTestId('close-mood-good'));
    fireEvent.click(screen.getByTestId('close-save'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.queryByTestId('verified-pr-celebration')).toBeNull();

    // Retry: the workout is already closed, so no new close transition and no replay.
    fireEvent.click(screen.getByTestId('close-save'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/today'));
    expect(screen.queryByTestId('verified-pr-celebration')).toBeNull();
    mockSession.workout.endedAt = null;
  });

  it('shows skip and hold controls on the guided train screen with fixed-CTA spacing', async () => {
    mockSession.phase = 'train';
    const { default: GuidedSessionPlayerPage } = await import('./page');
    render(<GuidedSessionPlayerPage />);

    expect(screen.getByText(/EJERCICIO 1 DE 2/)).toBeTruthy();
    expect(screen.getByText('SERIE 2 EN CURSO')).toBeTruthy();
    expect(screen.getByText(/70\.0/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('session-skip'));
    fireEvent.click(screen.getByTestId('session-hold'));
    await waitFor(() => expect(mockSkipCurrent).toHaveBeenCalledTimes(1));
    expect(mockHoldCurrent).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: SESSION_COPY.queueTitle })).toBeTruthy();
    expect(screen.getByTestId('guided-session-page').className).toContain('pb-[calc(10rem+env(safe-area-inset-bottom,0px))]');
    expect(screen.getByTestId('complete-set-bar').className).toContain('fixed');
  });

  it('moves suggested rest into a fixed bottom bar while hiding the complete CTA', async () => {
    mockSession.phase = 'train';
    mockRestTimer.active = true;
    mockRestTimer.remaining = 90;
    const { default: GuidedSessionPlayerPage } = await import('./page');
    render(<GuidedSessionPlayerPage />);

    const restBar = screen.getByTestId('rest-timer').closest('[data-testid="rest-timer-bar"]');
    expect(restBar?.className).toContain('fixed');
    expect(restBar?.className).toContain('bottom-app-cta');
    expect(screen.getByTestId('guided-exercise-card').contains(screen.getByTestId('rest-timer'))).toBe(false);
    expect(screen.queryByTestId('complete-set-bar')).toBeNull();
  });
});
