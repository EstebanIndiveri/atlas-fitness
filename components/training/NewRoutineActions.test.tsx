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
    expect(screen.getByRole('link', { name: 'Crear con Coach Atlas' }).getAttribute('href')).toBe(
      '/dashboard/routines/coach',
    );
    expect(screen.getByRole('link', { name: 'Crear manualmente' }).getAttribute('href')).toBe(
      '/dashboard/routines/new',
    );
    expect(screen.queryByText(/\d+\s/)).toBeNull();
  });
});
