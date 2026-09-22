/**
 * @jest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import type { OnboardingAnswers } from '@/lib/onboarding/state';

const requestCode = jest.fn<() => Promise<void>>();
const mockReadOnboardingAnswers = jest.fn<() => OnboardingAnswers | null>();

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

jest.mock('@/lib/onboarding/state', () => ({
  readOnboardingAnswers: mockReadOnboardingAnswers,
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

  beforeEach(() => {
    mockReadOnboardingAnswers.mockReturnValue(null);
  });

  afterEach(() => {
    global.fetch = originalFetch;
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

  it('renders honest profile data, Figma sections, version, Telegram, PWA and logout blocks', async () => {
    const Page = (await import('./page')).default;
    mockReadOnboardingAnswers.mockReturnValue({
      goal: 'muscle',
      pace: 'days-3',
      equipment: 'dumbbells',
    });
    global.fetch = jest.fn(async (input: unknown) => {
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
      });
    }) as unknown as typeof fetch;

    render(<Page />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Perfil' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Editar perfil (no configurado)' }).getAttribute('disabled')).toBe('');
    expect(screen.getByText('Esteban Indiveri')).toBeTruthy();
    expect(screen.getByText('esteban@example.com')).toBeTruthy();
    expect(screen.getByText('Plan Hipertrofia · Empuje')).toBeTruthy();
    expect(screen.getByText('ENTRENAMIENTO & HÁBITOS')).toBeTruthy();
    expect(screen.getByText('Objetivos')).toBeTruthy();
    expect(screen.getByText('Hipertrofia')).toBeTruthy();
    expect(screen.getByText('Plan de entrenamiento')).toBeTruthy();
    expect(screen.getByText('Empuje')).toBeTruthy();
    expect(screen.getByText('Equipamiento disponible')).toBeTruthy();
    expect(await screen.findByText('Mancuernas en casa')).toBeTruthy();
    expect(screen.getByTestId('equipment-settings').getAttribute('href')).toBe('/dashboard/plan/new');
    expect(screen.queryByText('Preferencias de Coach')).toBeNull();
    expect(screen.queryByText('Notificaciones y recordatorios')).toBeNull();
    expect(screen.getByText('No configurado')).toBeTruthy();
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
    });
  });

  it('uses truthful empty states when optional Perfil data sources are missing', async () => {
    const Page = (await import('./page')).default;
    global.fetch = jest.fn(async (input: unknown) => {
      if (String(input) === '/api/today') {
        return jsonResponse({ kind: 'no_plan', localDate: '2026-09-22', dayOfWeek: 2 });
      }

      return jsonResponse({
        id: 8,
        name: 'QA Test User',
        email: 'qa@atlas.test',
        telegramUserId: null,
      });
    }) as unknown as typeof fetch;

    render(<Page />);

    expect(await screen.findByText('QA Test User')).toBeTruthy();
    expect(screen.getByText('Plan no configurado')).toBeTruthy();
    expect(screen.getByText('Sin plan activo')).toBeTruthy();
    expect(screen.getByTestId('telegram-unlinked-status')).toBeTruthy();
    expect(screen.queryByText('@qatest_atlas_bot')).toBeNull();
    expect(screen.queryByText('82% adherencia')).toBeNull();
  });
});
