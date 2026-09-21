import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import { ProgressHeader } from './ProgressHeader';

describe('ProgressHeader', () => {
  it('renders the Atlas wordmark, progress title, month and freshness badge', () => {
    render(<ProgressHeader fromLocalDate="2026-09-01" toLocalDate="2026-09-30" now={new Date('2026-09-20T15:00:00.000Z')} updated />);

    expect(screen.getByText('Atlas')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Progreso' })).toBeTruthy();
    expect(screen.getByText('¿Estoy avanzando?')).toBeTruthy();
    expect(screen.getByText('septiembre de 2026')).toBeTruthy();
    expect(screen.getByText('Actualizado hoy')).toBeTruthy();
  });

  it('falls back to the current month when summary dates are absent', () => {
    render(<ProgressHeader fromLocalDate={null} toLocalDate={null} now={new Date('2026-10-03T15:00:00.000Z')} updated={false} />);

    expect(screen.getByText('octubre de 2026')).toBeTruthy();
    expect(screen.queryByText('Actualizado hoy')).toBeNull();
  });
});
