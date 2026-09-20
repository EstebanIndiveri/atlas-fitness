import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import type { WeekConsistency } from '@/types/week';

import { WeeklyConsistencyCard } from './WeeklyConsistencyCard';

const week: WeekConsistency = {
  weekStart: '2026-09-21',
  weekEnd: '2026-09-27',
  activeCount: 2,
  days: Array.from({ length: 7 }, (_, index) => ({
    date: `2026-09-${String(21 + index).padStart(2, '0')}`,
    weekdayIndex: index,
    active: index === 0 || index === 3,
    isToday: index === 3,
    isFuture: index > 3,
  })),
};

describe('WeeklyConsistencyCard', () => {
  it('renders active days for the current week as an atlas-computed metric', () => {
    render(<WeeklyConsistencyCard week={week} />);

    expect(screen.getByRole('heading', { name: 'Consistencia semanal' })).toBeTruthy();
    expect(screen.getByLabelText('Días activos esta semana').textContent).toContain('2 de 7');
    expect(screen.getByLabelText('Jueves (hoy, activo)')).toBeTruthy();
  });

  it('renders an empty state when week data is missing', () => {
    render(<WeeklyConsistencyCard week={null} />);

    expect(screen.getByRole('heading', { name: 'Sin consistencia semanal' })).toBeTruthy();
  });
});
