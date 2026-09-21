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
  it('renders active days and percent for the current week as atlas-computed metrics', () => {
    render(<WeeklyConsistencyCard week={week} />);

    expect(screen.getByRole('heading', { name: 'Consistencia semanal' })).toBeTruthy();
    expect(screen.getByLabelText('Días activos esta semana').textContent).toContain('4 de 7');
    expect(screen.getByLabelText('Consistencia semanal').textContent).toContain('57%');
    expect(screen.getByLabelText('Jueves (hoy, activo)')).toBeTruthy();
  });

  it('keeps header metrics on one line so the count and percent do not wrap awkwardly', () => {
    render(<WeeklyConsistencyCard week={{ ...week, activeCount: 1 }} />);

    expect(screen.getByTestId('weekly-consistency-header').className).toContain('items-start');
    expect(screen.getByLabelText('Días activos esta semana').className).toContain('whitespace-nowrap');
    expect(screen.getByLabelText('Consistencia semanal').className).toContain('whitespace-nowrap');
  });

  it('renders an empty state when week data is missing', () => {
    render(<WeeklyConsistencyCard week={null} />);

    expect(screen.getByRole('heading', { name: 'Sin consistencia semanal' })).toBeTruthy();
  });
});
