/**
 * @jest-environment jsdom
 */
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import { NewRoutineActions } from './NewRoutineActions';

describe('NewRoutineActions', () => {
  it('offers coach and manual creation actions without numeric claims', () => {
    render(<NewRoutineActions />);

    expect(screen.getByRole('heading', { name: 'Nueva rutina' })).toBeTruthy();
    expect(screen.getByText('Asistencia inteligente')).toBeTruthy();
    expect(screen.getByText('IA')).toBeTruthy();
    expect(screen.getByText('Atlas arma tu rutina según tus objetivos, tiempo y equipamiento')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Crear rutina con Coach Atlas/ }).getAttribute('href')).toBe(
      '/dashboard/routines/coach',
    );
    expect(screen.getByText('Configura series, cargas y tiempos desde cero')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Crear rutina manual/ }).getAttribute('href')).toBe(
      '/dashboard/routines/new',
    );
    expect(screen.queryByText(/\d+\s/)).toBeNull();
  });
});
