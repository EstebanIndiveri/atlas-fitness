import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

declare const jest: typeof import('@jest/globals').jest;

import type { TodayResponse } from '@/lib/api/today';
import { markOnboardingDone } from '@/lib/onboarding/state';

const push = jest.fn();
const replace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
}));

jest.mock('@/components/pwa/InstallToast', () => ({ InstallToast: () => null }));

jest.mock('@/hooks/useToday', () => ({ useToday: jest.fn() }));
jest.mock('@/hooks/useDailyCheckin', () => ({ useDailyCheckin: jest.fn() }));
jest.mock('@/hooks/useStreak', () => ({ useStreak: jest.fn() }));

jest.mock('@/lib/onboarding/state', () => {
  const actual = jest.requireActual<typeof import('@/lib/onboarding/state')>(
    '@/lib/onboarding/state',
  );
  return { ...actual, isOnboardingDone: jest.fn(actual.isOnboardingDone) };
});

import { useToday as useTodayHook } from '@/hooks/useToday';
import { useDailyCheckin as useDailyCheckinHook } from '@/hooks/useDailyCheckin';
import { useStreak as useStreakHook } from '@/hooks/useStreak';
import { isOnboardingDone } from '@/lib/onboarding/state';
import TodayPage from './page';

const actualIsOnboardingDone = jest.requireActual<
  typeof import('@/lib/onboarding/state')
>('@/lib/onboarding/state').isOnboardingDone;
const mockedIsOnboardingDone = jest.mocked(isOnboardingDone);

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
  planGoal: 'Hipertrofia',
  dayReason: null,
  completion: { completed: 0, total: 0 },
};

const noPlanToday: TodayResponse = {
  kind: 'no_plan',
  localDate: '2026-09-24',
  dayOfWeek: 4,
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
  mockedIsOnboardingDone.mockImplementation(actualIsOnboardingDone);
});

describe('TodayPage', () => {
  beforeEach(() => {
    markOnboardingDone();
  });

  it('redirects first-time users to the onboarding wizard', async () => {
    window.localStorage.clear();
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

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/onboarding'));
    expect(screen.queryByRole('heading', { level: 1, name: 'Hola, Esteban' })).toBeNull();
  });

  it('renders Hoy after onboarding completion was persisted', async () => {
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
    expect(replace).not.toHaveBeenCalled();
  });

  it('does not redirect onboarded users when the initial render snapshot is stale', async () => {
    // Reproduces the SSR/hydration path: the render snapshot is stale (false)
    // while the live store is true. The redirect must read the live value, not
    // the snapshot, so an already-onboarded user is never bounced to the wizard.
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
    let calls = 0;
    mockedIsOnboardingDone.mockImplementation(() => {
      calls += 1;
      return calls > 1;
    });

    render(<TodayPage />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Hola, Esteban' })).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
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
      expect(push).toHaveBeenCalledWith('/dashboard/session/42');
    });
    const workoutCall = jest.mocked(global.fetch).mock.calls.find((call) =>
      String(call[0]).includes('/api/workouts'),
    );
    expect(workoutCall?.[1]).toMatchObject({ method: 'POST', body: JSON.stringify({ routineId: 7 }) });
  });

  it('navigates the coach adapt action to the dedicated adaptation screen', async () => {
    mockHooks(workoutToday);
    mockFetch((url) => {
      if (url.includes('/api/auth/me')) {
        return jsonResponse({ id: 1, name: 'Esteban', email: 'e@x.com', telegramUserId: null });
      }
      return jsonResponse({
        id: 7,
        slug: 'push-a',
        name: 'Push A',
        description: null,
        kind: 'gym',
        restSeconds: 90,
        isSystem: false,
        exercises: [],
      });
    });

    render(<TodayPage />);
    const adaptButton = await screen.findByRole('button', { name: /Adaptar con Coach Atlas/i });
    fireEvent.click(adaptButton);

    expect(push).toHaveBeenCalledWith(
      '/dashboard/session/adapt?routineId=7&routineName=Push%20A&planGoal=Hipertrofia',
    );
  });

  it('navigates to the plan builder when creating a plan from the golden path', async () => {
    mockHooks(noPlanToday);
    mockFetch((url) => {
      if (url.includes('/api/auth/me')) {
        return jsonResponse({ id: 1, name: 'Esteban', email: 'e@x.com', telegramUserId: null });
      }
      return jsonResponse(null, false);
    });

    render(<TodayPage />);
    const createButton = await screen.findByRole('button', { name: 'Crear mi plan' });
    fireEvent.click(createButton);

    expect(push).toHaveBeenCalledWith('/dashboard/plan/new');
  });

  it('greets without a name when the profile fails to load', async () => {
    mockHooks(null);
    mockFetch(() => jsonResponse(null, false));

    render(<TodayPage />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Hola' })).toBeTruthy();
  });
});
