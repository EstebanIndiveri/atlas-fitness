import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen, within } from '@testing-library/react';
import { APP_NAV_LINKS, bottomNavTestId } from './nav-links';
import type { BeforeInstallPromptEvent } from '@/types/pwa';

class DeferredInstallEvent extends Event implements BeforeInstallPromptEvent {
  readonly platforms = ['web'];
  readonly userChoice = Promise.resolve({ outcome: 'dismissed' as const, platform: 'web' });
  readonly prompt = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
}

function installMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: jest.fn((query: string): MediaQueryList => ({
      matches: query === '(display-mode: standalone)' ? false : false,
      media: query,
      onchange: null,
      addEventListener: jest.fn<MediaQueryList['addEventListener']>(),
      removeEventListener: jest.fn<MediaQueryList['removeEventListener']>(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(() => true),
    })),
  });
}

jest.mock('next/navigation', () => ({
  usePathname: () => null,
}));

import { AppShell } from './AppShell';

describe('AppShell', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/dashboard');
    window.localStorage.clear();
    installMatchMedia();
  });

  it('renders skip link, header and main landmark without the in-flow install prompt for the app variant', async () => {
    render(
      <AppShell variant="app">
        <p>Bienvenido</p>
      </AppShell>,
    );

    expect(screen.getByRole('link', { name: 'Saltar al contenido' }).getAttribute('href')).toBe(
      '#contenido',
    );
    expect(screen.getByTestId('app-header')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Pestañas' })).toBeTruthy();
    expect(screen.getByTestId('app-bottom-nav')).toBeTruthy();

    const headerNav = screen.getByRole('navigation', { name: 'Principal' });
    expect(within(headerNav).getByRole('link', { name: 'Hoy' })).toBeTruthy();
    expect(within(headerNav).getByRole('link', { name: 'Entrenar' })).toBeTruthy();
    expect(within(headerNav).getByRole('link', { name: 'Progreso' })).toBeTruthy();
    expect(screen.getByTestId('profile-link').textContent).toBe('Perfil');
    const tabNav = screen.getByRole('navigation', { name: 'Pestañas' });
    for (const link of APP_NAV_LINKS) {
      const tab = within(tabNav).getByTestId(bottomNavTestId(link.tabId));
      expect(tab.textContent).toContain(link.label);
      expect(tab.getAttribute('href')).toBe(link.href);
      expect(within(tab).getByTestId(`${link.tabId}-tab-icon`)).toBeTruthy();
    }
    expect(screen.getByRole('button', { name: 'Notificaciones' })).toBeTruthy();
    expect((screen.getByTestId('notifications-button') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
    expect(screen.getByRole('main').id).toBe('contenido');
    expect(screen.getByRole('main').className).toContain('pb-app-nav');

    // The in-flow install card was removed from the shell in favour of the
    // transient InstallToast on Hoy; it must not mount even when installable.
    act(() => {
      window.dispatchEvent(new DeferredInstallEvent('beforeinstallprompt'));
    });

    expect(screen.queryByTestId('app-install-prompt')).toBeNull();
  });

  it('marks the active bottom tab with aria-current and keeps inactive tabs muted', () => {
    window.history.pushState({}, '', '/dashboard/session');

    render(
      <AppShell variant="app">
        <p>Entreno</p>
      </AppShell>,
    );

    const activeTab = screen.getByTestId('bottom-nav-session');
    expect(activeTab.getAttribute('aria-current')).toBe('page');
    expect(activeTab.className).toContain('text-brand');
    expect(activeTab.className).toContain('bg-brand-muted');

    for (const tabId of ['today', 'progress', 'profile']) {
      const inactiveTab = screen.getByTestId(bottomNavTestId(tabId));
      expect(inactiveTab.getAttribute('aria-current')).toBeNull();
      expect(inactiveTab.className).toContain('text-ink-muted');
      expect(inactiveTab.className).not.toContain('text-brand');
    }
  });

  it('keeps header nav for desktop and bottom tabs for the app variant', () => {
    render(
      <AppShell variant="app">
        <p>Bienvenido</p>
      </AppShell>,
    );

    const headerNav = screen.getByRole('navigation', { name: 'Principal' });
    const tabNav = screen.getByRole('navigation', { name: 'Pestañas' });
    expect(headerNav.className).toContain('hidden');
    expect(headerNav.className).toContain('md:flex');
    expect(tabNav.className).toContain('md:hidden');
    expect(screen.getByTestId('app-header').className).toContain('pt-safe');
    expect(screen.getByTestId('app-shell').className).toContain('px-safe');
    expect(screen.getByTestId('app-shell').className).toContain('min-h-dvh');
  });

  it('renders public auth links without logout or bottom tabs', () => {
    render(
      <AppShell variant="public">
        <p>Landing</p>
      </AppShell>,
    );

    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).toBeNull();
    expect(screen.queryByTestId('app-bottom-nav')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Pestañas' })).toBeNull();
  });
});
