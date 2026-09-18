import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { EmptyState, ErrorState, LoadingState } from './states';

describe('LoadingState', () => {
  it('announces loading with role=status', () => {
    render(<LoadingState />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.textContent).toMatch(/Cargando/);
  });
});

describe('ErrorState', () => {
  it('exposes the message as an alert', () => {
    render(<ErrorState message="Email o contraseña inválidos" />);
    const alert = screen.getByRole('alert');
    expect(alert.getAttribute('data-testid')).toBe('form-error');
    expect(alert.textContent).toContain('Email o contraseña inválidos');
  });
});

describe('EmptyState', () => {
  it('renders title, description and action', () => {
    render(
      <EmptyState
        title="Todavía no hay entrenos"
        description="No tienes entrenamientos registrados aún."
        action={<button type="button">Iniciar tu primer entrenamiento</button>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Todavía no hay entrenos' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Iniciar tu primer entrenamiento' })).toBeTruthy();
  });
});
