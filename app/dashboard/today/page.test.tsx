import { afterEach, describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

declare const jest: typeof import('@jest/globals').jest;

import type { TodayResponse } from '@/lib/api/today';
import { ONBOARDING_COPY, ONBOARDING_TEST_IDS } from '@/lib/copy/onboarding';
import { markOnboardingDone } from '@/lib/onboarding/state';

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

jest.mock('@/hooks/useToday', () => ({ useToday: jest.fn() }));
jest.mock('@/hooks/useDailyCheckin', () => ({ useDailyCheckin: jest.fn() }));
jest.mock('@/hooks/useStreak', () => ({ useStreak: jest.fn() }));

import { useToday as useTodayHook } from '@/hooks/useToday';
import { useDailyCheckin as useDailyCheckinHook } from '@/hooks/useDailyCheckin';
import { useStreak as useStreakHook } from '@/hooks/useStreak';
import TodayPage from './page';

const useToday = jest.mocked(useTodayHook);
const useDailyCheckin = jest.mocked(useDailyCheckinHook);
const useStreak = jest.mocked(useStreakHook);

const workoutToday: TodayResponse = {
  kind: 'workout',
  localDate: '2026-09-24',
  dayOfWeek: 4,
  trainingPlanId: 1,
  scheduledRoutineId: 2,
  routineId: 7,
  routineName: 'Push A',
  planGoal: null,
  dayReason: null,
  completion: { completed: 0, total: 0 },
};

function mockHooks(today: TodayResponse | null) {
  useToday.mockReturnValue({ today, loading: false, error: null, reload: jest.fn() });
  useDailyCheckin.mockReturnValue({
    checkin: null,
    loading: false,
    saving: false,
    error: null,
    reload: jest.fn(),
    submit: jest.fn<ReturnType<typeof useDailyCheckinHook>['submit']>(),
  });
  useStreak.mockReturnValue({
    streak: { currentStreak: 3, longestStreak: 5, lastActiveDate: '2026-09-24' },
    loading: false,
    error: null,
    reload: jest.fn(),
  });
}

function mockFetch(handler: (url: string) => Response) {
  global.fetch = jest.fn((input: unknown) =>
    Promise.resolve(handler(String(input))),
  ) as unknown as typeof fetch;
}

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

afterEach(() => {
  window.localStorage.clear();
  jest.clearAllMocks();
});

describe('TodayPage', () => {
  it('shows onboarding for first-time users on Hoy', async () => {
    mockHooks(workoutToday);
    mockFetch((url) => {
      if (url.includes('/api/auth/me')) {
        return jsonResponse({ id: 1, name: 'Esteban', email: 'e@x.com', telegramUserId: null });
      }
      return jsonResponse({
        id: 7,
        name: 'Push A',
        kind: 'gym',
        description: null,
        exercises: [{ id: 1, name: 'Bench', targetSets: 4 }],
      });
    });

    render(<TodayPage />);

    expect(await screen.findByRole('region', { name: ONBOARDING_COPY.title })).toBeTruthy();
    expect(screen.getByTestId(ONBOARDING_TEST_IDS.card)).toBeTruthy();
  });

  it('hides onboarding on Hoy after completion was persisted', async () => {
    markOnboardingDone();
    mockHooks(workoutToday);
    mockFetch((url) => {
      if (url.includes('/api/auth/me')) {
        return jsonResponse({ id: 1, name: 'Esteban', email: 'e@x.com', telegramUserId: null });
      }
      return jsonResponse({
        id: 7,
        name: 'Push A',
        kind: 'gym',
        description: null,
        exercises: [{ id: 1, name: 'Bench', targetSets: 4 }],
      });
    });

    render(<TodayPage />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Hola, Esteban' })).toBeTruthy();
    expect(screen.queryByTestId(ONBOARDING_TEST_IDS.card)).toBeNull();
  });

  it('greets the loaded user and renders every Today section', async () => {
    mockHooks(workoutToday);
    mockFetch((url) => {
      if (url.includes('/api/auth/me')) {
        return jsonResponse({ id: 1, name: 'Esteban', email: 'e@x.com', telegramUserId: null });
      }
      return jsonResponse({
        id: 7,
        name: 'Push A',
        kind: 'gym',
        description: null,
        exercises: [{ id: 1, name: 'Bench', targetSets: 4 }],
      });
    });

    render(<TodayPage />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Hola, Esteban' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Hábitos de hoy' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Esta semana' })).toBeTruthy();
  });

  it('starts the scheduled workout with its routineId and navigates', async () => {
    mockHooks(workoutToday);
    mockFetch((url) => {
      if (url.includes('/api/auth/me')) {
        return jsonResponse({ id: 1, name: 'Esteban', email: 'e@x.com', telegramUserId: null });
      }
      if (url.includes('/api/workouts')) {
        return jsonResponse({ id: 42 });
      }
      return jsonResponse({
        id: 7,
        name: 'Push A',
        kind: 'gym',
        description: null,
        exercises: [{ id: 1, name: 'Bench', targetSets: 4 }],
      });
    });

    render(<TodayPage />);
    const startButton = await screen.findByRole('button', { name: /Empezar entrenamiento/i });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/dashboard/workout/42');
    });
    const workoutCall = jest.mocked(global.fetch).mock.calls.find((call) =>
      String(call[0]).includes('/api/workouts'),
    );
    expect(workoutCall?.[1]).toMatchObject({ method: 'POST', body: JSON.stringify({ routineId: 7 }) });
  });

  it('greets without a name when the profile fails to load', async () => {
    mockHooks(null);
    mockFetch(() => jsonResponse(null, false));

    render(<TodayPage />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Hola' })).toBeTruthy();
  });
});
