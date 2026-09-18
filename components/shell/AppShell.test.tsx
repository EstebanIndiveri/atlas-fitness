import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
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
    expect(screen.getByRole('link', { name: 'Inicio' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Historial' })).toBeTruthy();
    expect(screen.getByTestId('settings-link').textContent).toBe('Ajustes');
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
    expect(screen.getByRole('main').id).toBe('contenido');
  });

  it('renders public auth links without logout', () => {
    render(
      <AppShell variant="public">
        <p>Landing</p>
      </AppShell>,
    );

    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).toBeNull();
  });
});
