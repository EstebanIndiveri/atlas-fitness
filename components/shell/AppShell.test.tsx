import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, within } from '@testing-library/react';
import { AppShell } from './AppShell';

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

describe('AppShell', () => {
  it('renders skip link, header and main landmark for the app variant', () => {
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
    expect(screen.getByTestId('bottom-nav-profile').textContent).toContain('Perfil');
    expect(screen.getByRole('button', { name: 'Notificaciones' })).toBeTruthy();
    expect((screen.getByTestId('notifications-button') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
    expect(screen.getByRole('main').id).toBe('contenido');
    expect(screen.getByRole('main').className).toContain('pb-app-nav');
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
