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

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  } as Response;
}

describe('SettingsPage', () => {
  const originalFetch = global.fetch;

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

  it('renders honest profile data and preserves Telegram, PWA and logout blocks', async () => {
    const Page = (await import('./page')).default;
    global.fetch = jest.fn(async () =>
      jsonResponse({
        id: 7,
        name: 'Esteban Indiveri',
        email: 'esteban@example.com',
        telegramUserId: '4242',
      }),
    ) as unknown as typeof fetch;

    render(<Page />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Perfil' })).toBeTruthy();
    expect(screen.getByText('Esteban Indiveri')).toBeTruthy();
    expect(screen.getByText('esteban@example.com')).toBeTruthy();
    expect(screen.getByTestId('telegram-settings')).toBeTruthy();
    expect(screen.getByTestId('telegram-linked-status')).toBeTruthy();
    expect(screen.getByTestId('generate-link-code')).toBeTruthy();
    expect(screen.getByTestId('pwa-install-settings')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
    expect(screen.queryByText(/82%|Miembro|verificado/i)).toBeNull();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/me');
    });
  });
});
