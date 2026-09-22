import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import type { WeekConsistency } from '@/types/week';

import { WeeklyConsistencyCard } from './WeeklyConsistencyCard';

const week: WeekConsistency = {
  weekStart: '2026-09-21',
  weekEnd: '2026-09-27',
  activeCount: 4,
  days: Array.from({ length: 7 }, (_, index) => ({
    date: `2026-09-${String(21 + index).padStart(2, '0')}`,
    weekdayIndex: index,
    active: index < 4,
    isToday: index === 3,
    isFuture: index > 3,
  })),
};

describe('WeeklyConsistencyCard', () => {
  it('renders one clear primary percent with active-day context as atlas-computed metrics', () => {
    render(<WeeklyConsistencyCard week={week} />);

    expect(screen.getByRole('heading', { name: 'Consistencia semanal' })).toBeTruthy();
    expect(screen.getByLabelText('Días activos esta semana').textContent).toContain('4 de 7');
    expect(screen.getByLabelText('Consistencia semanal').textContent).toContain('57%');
    expect(screen.getByText('Media 57%')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Barra de consistencia semanal' }).getAttribute('aria-valuenow')).toBe('57');
    expect(screen.getByText('Calculado por Atlas')).toBeTruthy();
    expect(screen.getByLabelText('Jueves (hoy, activo)')).toBeTruthy();
  });

  it('lets the header and metric panel shrink instead of overflowing on narrow screens', () => {
    render(<WeeklyConsistencyCard week={{ ...week, activeCount: 1 }} />);

    expect(screen.getByTestId('weekly-consistency-header').className).toContain('flex-col');
    expect(screen.getByTestId('weekly-consistency-metrics').className).toContain('min-w-0');
    expect(screen.getByTestId('weekly-consistency-metrics').className).toContain('overflow-hidden');
    expect(screen.getByLabelText('Días activos esta semana').textContent).toContain('1 de 7');
    expect(screen.getByLabelText('Consistencia semanal').textContent).toContain('14%');
  });

  it('renders an empty state when week data is missing', () => {
    render(<WeeklyConsistencyCard week={null} />);

    expect(screen.getByRole('heading', { name: 'Sin consistencia semanal' })).toBeTruthy();
  });
});
