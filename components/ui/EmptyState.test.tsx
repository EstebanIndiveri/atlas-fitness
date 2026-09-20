import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

import { EMPTY_STATE_COPY, EMPTY_STATE_KEYS } from '@/lib/copy/empty-states';

import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders a labelled region with heading, title and description', () => {
    render(<EmptyState title="Todavía no tenés un plan" description="Elegí cómo empezar." />);

    expect(screen.getByRole('region', { name: 'Todavía no tenés un plan' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Todavía no tenés un plan' })).toBeTruthy();
    expect(screen.getByText('Elegí cómo empezar.')).toBeTruthy();
  });

  it('renders every action with its label', () => {
    render(
      <EmptyState
        title="Todavía no tenés un plan"
        description="Elegí cómo empezar."
        actions={[
          { label: 'Crear mi plan', href: '/dashboard/plan/new', variant: 'primary' },
          { label: 'Crear rutina manualmente', href: '/dashboard/routines/new', variant: 'secondary' },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: 'Crear mi plan' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Crear rutina manualmente' })).toBeTruthy();
  });

  it('distinguishes primary and secondary action variants', () => {
    render(
      <EmptyState
        title="Todavía no tenés un plan"
        description="Elegí cómo empezar."
        actions={[
          { label: 'Crear mi plan', onClick: () => undefined, variant: 'primary' },
          { label: 'Crear rutina manualmente', onClick: () => undefined, variant: 'secondary' },
        ]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Crear mi plan' }).className).toContain('bg-brand');
    expect(screen.getByRole('button', { name: 'Crear rutina manualmente' }).className).toContain('ring-line');
  });

  it('fires onClick actions from keyboard-reachable buttons', () => {
    const onClick = jest.fn();

    render(
      <EmptyState
        title="¿Cómo estás hoy?"
        description="Responder toma menos de 10 segundos."
        actions={[{ label: 'Responder ahora', onClick }]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Responder ahora' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders href actions as links', () => {
    render(
      <EmptyState
        title="Tu progreso empieza con tu primera sesión"
        description="Registrá datos reales desde el primer entreno."
        actions={[{ label: 'Empezar entrenamiento', href: '/dashboard/workout/start' }]}
      />,
    );

    expect(screen.getByRole('link', { name: 'Empezar entrenamiento' }).getAttribute('href')).toBe(
      '/dashboard/workout/start',
    );
  });
});

describe('EMPTY_STATE_COPY', () => {
  it('contains all canonical Atlas Adaptive Core V1 empty states with non-empty copy', () => {
    expect(EMPTY_STATE_KEYS).toEqual(['no_plan', 'no_history', 'no_checkin', 'ai_unavailable']);

    for (const key of EMPTY_STATE_KEYS) {
      const state = EMPTY_STATE_COPY[key];

      expect(state.title.trim().length).toBeGreaterThan(0);
      expect(state.description.trim().length).toBeGreaterThan(0);
      expect(state.actions.length).toBeGreaterThan(0);
      for (const action of state.actions) {
        expect(action.label.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
