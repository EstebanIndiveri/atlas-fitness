import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

declare const jest: typeof import('@jest/globals').jest;

import type { TodayResponse } from '@/lib/api/today';
const push = jest.fn();
const replace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
}));

jest.mock('@/components/pwa/InstallToast', () => ({ InstallToast: () => null }));

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
  planGoal: 'Hipertrofia',
  dayReason: null,
  completion: { completed: 0, total: 0 },
};

const noPlanToday: TodayResponse = {
  kind: 'no_plan',
  localDate: '2026-09-24',
  dayOfWeek: 4,
};

let serverOnboardingCompleted = true;
let serverOnboardingError: Response | null = null;

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
  global.fetch = jest.fn((input: unknown) => {
    const url = String(input);
    if (url.includes('/api/profile/onboarding')) {
      if (serverOnboardingError) {
        return Promise.resolve(serverOnboardingError);
      }
      return Promise.resolve(jsonResponse({ completed: serverOnboardingCompleted }));
    }
    return Promise.resolve(handler(url));
  }) as unknown as typeof fetch;
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
  beforeEach(() => {
    serverOnboardingCompleted = true;
    serverOnboardingError = null;
  });

  it('redirects when the server says onboarding is incomplete despite a local completion marker', async () => {
    window.localStorage.setItem('atlas:onboarding:welcome-done', 'true');
    serverOnboardingCompleted = false;
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

  it('renders Hoy from persisted completion when local storage has no completion marker', async () => {
    window.localStorage.clear();
    serverOnboardingCompleted = true;
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

  it('shows a retryable error when the server completion state cannot be loaded', async () => {
    serverOnboardingError = jsonResponse({ code: 'SERVICE_UNAVAILABLE' }, false);
    mockHooks(workoutToday);
    mockFetch(() => jsonResponse(null));

    render(<TodayPage />);

    expect(await screen.findByText(
      'No pudimos comprobar si el onboarding está completo. Revisá tu conexión e intentá de nuevo.',
    )).toBeTruthy();
    serverOnboardingError = null;
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Hola' })).toBeTruthy();
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
    expect(screen.getByRole('heading', { name: 'Hábitos Diarios' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Consistencia Semanal' })).toBeTruthy();
  });

  it('does not present a missing Today response as a confirmed empty workout while loading', async () => {
    mockHooks(null);
    useToday.mockReturnValue({
      today: null,
      loading: true,
      error: null,
      reload: jest.fn(),
    });
    mockFetch((url) => {
      if (url.includes('/api/auth/me')) {
        return jsonResponse({ id: 1, name: 'Esteban', email: 'e@x.com', telegramUserId: null });
      }
      return jsonResponse(null);
    });

    render(<TodayPage />);

    expect(await screen.findByText('Cargando el entrenamiento de hoy…')).toBeTruthy();
    expect(screen.queryByText('Necesitás un entrenamiento de hoy para adaptar.')).toBeNull();
  });

  it('shows the Today load error instead of a confirmed empty workout', async () => {
    mockHooks(null);
    useToday.mockReturnValue({
      today: null,
      loading: false,
      error: 'No se pudo cargar el plan de hoy.',
      reload: jest.fn(),
    });
    mockFetch((url) => {
      if (url.includes('/api/auth/me')) {
        return jsonResponse({ id: 1, name: 'Esteban', email: 'e@x.com', telegramUserId: null });
      }
      return jsonResponse(null);
    });

    render(<TodayPage />);

    expect((await screen.findAllByText('No se pudo cargar el plan de hoy.')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Necesitás un entrenamiento de hoy para adaptar.')).toBeNull();
  });

  it('requires a completed user check-in before requesting a free-text preview', async () => {
    mockHooks(workoutToday);
    const fetchMock = jest.fn((url: unknown) => {
      const value = String(url);
      if (value.includes('/api/profile/onboarding')) {
        return Promise.resolve(jsonResponse({ completed: serverOnboardingCompleted }));
      }
      if (value.includes('/api/auth/me')) {
        return Promise.resolve(jsonResponse({ id: 1, name: 'Esteban', email: 'e@x.com', telegramUserId: null }));
      }
      return Promise.resolve(jsonResponse({
        id: 7,
        name: 'Push A',
        kind: 'gym',
        description: null,
        exercises: [{ id: 1, name: 'Bench', targetSets: 4 }],
      }));
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<TodayPage />);
    const previewButton = await screen.findByRole('button', { name: 'Tengo 30 min' });

    expect(previewButton.hasAttribute('disabled')).toBe(true);
    expect(await screen.findByText('Registrá tu ánimo y energía para preparar una vista previa.')).toBeTruthy();
    fireEvent.click(previewButton);

    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/coach/preview'))).toBe(false);
  });

  it('blocks Coach preview while the user check-in save is pending', async () => {
    mockHooks(workoutToday);
    useDailyCheckin.mockReturnValue({
      checkin: {
        id: 12,
        userId: 1,
        localDate: '2026-09-24',
        mood: 4,
        energy: 'high',
        note: null,
        createdAt: '2026-09-24T10:00:00.000Z',
        updatedAt: '2026-09-24T10:00:00.000Z',
      },
      loading: false,
      saving: true,
      error: null,
      reload: jest.fn(),
      submit: jest.fn<ReturnType<typeof useDailyCheckinHook>['submit']>(),
    });
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

    expect(await screen.findByText('Guardando tu check-in…')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tengo 30 min' }).hasAttribute('disabled')).toBe(true);
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
