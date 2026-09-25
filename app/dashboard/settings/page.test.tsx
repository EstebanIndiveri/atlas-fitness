/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';

const requestCode = jest.fn<() => Promise<void>>();

jest.mock('@/hooks/useLinkCode', () => ({
  useLinkCode: () => ({
    code: null,
    loading: false,
    error: null,
    requestCode,
  }),
}));

jest.mock('@/components/pwa/AppInstallPrompt', () => ({
  AppInstallPrompt: () => <div data-testid="app-install-prompt">Instalar</div>,
}));

jest.mock('@/hooks/useInstallPrompt', () => ({
  useInstallPrompt: () => ({
    canInstall: true,
    isStandalone: false,
  }),
}));

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('SettingsPage', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('renders the loading state while the profile request is pending', async () => {
    const Page = (await import('./page')).default;
    global.fetch = jest.fn(() => new Promise<Response>(() => undefined)) as unknown as typeof fetch;

    render(<Page />);

    expect(screen.getByRole('status').textContent).toContain('Cargando');
  });

  it('renders the error state when the profile request fails', async () => {
    const Page = (await import('./page')).default;
    global.fetch = jest.fn(async () => jsonResponse(null, false)) as unknown as typeof fetch;

    render(<Page />);

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('No pudimos cargar tu perfil. Probá de nuevo.')).toBeTruthy();
  });

  it('renders saved profile data, real activity, canonical links, Telegram, PWA and logout blocks', async () => {
    const Page = (await import('./page')).default;
    localStorage.setItem('atlas:onboarding:answers', JSON.stringify({
      goal: 'fitness',
      pace: 'days-2',
      equipment: 'bodyweight',
    }));
    global.fetch = jest.fn(async (input: unknown) => {
      if (String(input) === '/api/profile/preferences') {
        return jsonResponse({
          hasSavedPreferences: true,
          preferences: { goal: 'muscle', pace: 'days-3', equipment: 'dumbbells' },
        });
      }
      if (String(input) === '/api/stats/week') {
        return jsonResponse({ activeCount: 2 });
      }
      if (String(input) === '/api/today') {
        return jsonResponse({
          kind: 'workout',
          localDate: '2026-09-22',
          dayOfWeek: 2,
          trainingPlanId: 3,
          scheduledRoutineId: 4,
          routineId: 5,
          routineName: 'Empuje',
          planGoal: 'Hipertrofia',
          dayReason: null,
          completion: { completed: 0, total: 4 },
        });
      }

      return jsonResponse({
        id: 7,
        name: 'Esteban Indiveri',
        email: 'esteban@example.com',
        telegramUserId: '4242',
        createdAt: '2024-09-15T15:00:00.000Z',
        activeTrainingPlanId: 3,
      });
    }) as unknown as typeof fetch;

    render(<Page />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Perfil' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Editar perfil (no configurado)' }).getAttribute('disabled')).toBe('');
    expect(screen.getByText('Esteban Indiveri')).toBeTruthy();
    expect(screen.getByText('esteban@example.com')).toBeTruthy();
    expect(screen.getByText('Plan activo · Hipertrofia · Empuje')).toBeTruthy();
    expect(screen.getByText('ENTRENAMIENTO & HÁBITOS')).toBeTruthy();
    expect(screen.getByText('Plan de entrenamiento')).toBeTruthy();
    expect(screen.getByText('Objetivo del plan: Hipertrofia')).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2, name: 'Preferencias de Coach' })).toBeNull();
    expect(await screen.findByText('Mancuernas en casa')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Editar equipo disponible' })).toBeTruthy();
    expect(screen.getByTestId('training-plan-settings').getAttribute('href')).toBe('/dashboard/plan/3');
    expect(screen.getByTestId('routines-settings').getAttribute('href')).toBe('/dashboard/routines');
    expect(screen.getByTestId('habits-settings').getAttribute('href')).toBe('/dashboard/habits');
    expect(screen.getByText('EN ATLAS')).toBeTruthy();
    expect(screen.getByText('Desde septiembre de 2024')).toBeTruthy();
    expect(screen.getByText('DÍAS ACTIVOS ESTA SEMANA')).toBeTruthy();
    expect(await screen.findByText('2 de 7 días')).toBeTruthy();
    expect(screen.getByText('Entreno finalizado o check-in')).toBeTruthy();
    expect(screen.queryByText('Notificaciones y recordatorios')).toBeNull();
    expect(screen.getByTestId('telegram-settings')).toBeTruthy();
    expect(screen.getByTestId('telegram-linked-status')).toBeTruthy();
    expect(screen.getByTestId('generate-link-code')).toBeTruthy();
    expect(screen.getByText('Estado de sincronización')).toBeTruthy();
    expect(screen.getByText('ID 4242')).toBeTruthy();
    expect(screen.getByTestId('pwa-install-settings')).toBeTruthy();
    expect(screen.getByText('Disponible')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
    expect(screen.getByText(/^v\d/)).toBeTruthy();
    expect(screen.queryByText(/82%|Miembro Sep 2024|verificado|✓/i)).toBeNull();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/me');
      expect(global.fetch).toHaveBeenCalledWith('/api/today');
      expect(global.fetch).toHaveBeenCalledWith('/api/stats/week');
    });
  });

  it('uses truthful empty states when optional Perfil data sources are missing', async () => {
    const Page = (await import('./page')).default;
    global.fetch = jest.fn(async (input: unknown) => {
      if (String(input) === '/api/today') {
        return jsonResponse({ kind: 'no_plan', localDate: '2026-09-22', dayOfWeek: 2 });
      }
      if (String(input) === '/api/profile/preferences') {
        return jsonResponse({
          hasSavedPreferences: false,
          preferences: { goal: null, pace: null, equipment: null },
        });
      }
      if (String(input) === '/api/stats/week') {
        return jsonResponse({ activeCount: 0 });
      }

      return jsonResponse({
        id: 8,
        name: 'QA Test User',
        email: 'qa@atlas.test',
        telegramUserId: null,
        createdAt: '2024-09-15T15:00:00.000Z',
        activeTrainingPlanId: null,
      });
    }) as unknown as typeof fetch;

    render(<Page />);

    expect(await screen.findByText('QA Test User')).toBeTruthy();
    expect(screen.getAllByText('Sin plan activo')).toHaveLength(2);
    expect(screen.getByTestId('telegram-unlinked-status')).toBeTruthy();
    expect(screen.getByTestId('training-plan-settings').getAttribute('href')).toBe('/dashboard/plan/new');
    expect(screen.getByTestId('routines-settings').getAttribute('href')).toBe('/dashboard/routines');
    expect(screen.getByTestId('habits-settings').getAttribute('href')).toBe('/dashboard/habits');
    expect(screen.getByText('0 de 7 días')).toBeTruthy();
    expect(screen.queryByText('@qatest_atlas_bot')).toBeNull();
  });

  it('keeps an active plan link independent from today scheduled-routine data', async () => {
    const Page = (await import('./page')).default;
    global.fetch = jest.fn(async (input: unknown) => {
      if (String(input) === '/api/today') {
        return jsonResponse({ kind: 'no_plan', localDate: '2026-09-22', dayOfWeek: 2 });
      }
      if (String(input) === '/api/profile/preferences') {
        return jsonResponse({
          hasSavedPreferences: false,
          preferences: { goal: null, pace: null, equipment: null },
        });
      }
      if (String(input) === '/api/stats/week') {
        return jsonResponse({ activeCount: 0 });
      }

      return jsonResponse({
        id: 8,
        name: 'QA Test User',
        email: 'qa@atlas.test',
        telegramUserId: null,
        createdAt: '2024-09-15T15:00:00.000Z',
        activeTrainingPlanId: 19,
      });
    }) as unknown as typeof fetch;

    render(<Page />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Perfil' })).toBeTruthy();
    expect(screen.getByTestId('training-plan-settings').getAttribute('href')).toBe('/dashboard/plan/19');
    expect(screen.getByTestId('training-plan-settings').textContent).toContain('Plan activo');
  });

  it('shows an honest error state when weekly activity cannot be loaded', async () => {
    const Page = (await import('./page')).default;
    global.fetch = jest.fn(async (input: unknown) => {
      if (String(input) === '/api/today') {
        return jsonResponse({ kind: 'no_plan', localDate: '2026-09-22', dayOfWeek: 2 });
      }
      if (String(input) === '/api/profile/preferences') {
        return jsonResponse({
          hasSavedPreferences: false,
          preferences: { goal: null, pace: null, equipment: null },
        });
      }
      if (String(input) === '/api/stats/week') {
        return jsonResponse({ code: 'SERVICE_UNAVAILABLE' }, false);
      }

      return jsonResponse({
        id: 8,
        name: 'QA Test User',
        email: 'qa@atlas.test',
        telegramUserId: null,
        createdAt: '2024-09-15T15:00:00.000Z',
        activeTrainingPlanId: null,
      });
    }) as unknown as typeof fetch;

    render(<Page />);

    expect(await screen.findByText('No disponible')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('No pudimos cargar tu actividad semanal.');
  });
});
