import { describe, expect, it } from '@jest/globals';
import { render, screen, within } from '@testing-library/react';

import type { WeekDayConsistency } from '@/types/week';
import { WeekDayStrip } from './WeekDayStrip';

function buildDays(activeIndexes: number[], todayIndex: number): WeekDayConsistency[] {
  const dates = [
    '2026-09-21',
    '2026-09-22',
    '2026-09-23',
    '2026-09-24',
    '2026-09-25',
    '2026-09-26',
    '2026-09-27',
  ];
  return dates.map((date, index) => ({
    date,
    weekdayIndex: index,
    active: activeIndexes.includes(index),
    isToday: index === todayIndex,
    isFuture: index > todayIndex,
  }));
}

describe('WeekDayStrip', () => {
  it('marks the real current Córdoba day as HOY and the rest as neutral', () => {
    // 2026-09-24 is a Thursday in Córdoba.
    render(<WeekDayStrip now={new Date('2026-09-24T12:00:00.000Z')} />);

    const list = screen.getByRole('list', { name: 'Días de la semana' });
    expect(within(list).getByText('HOY')).toBeTruthy();
    expect(within(list).getByLabelText('Jueves (hoy)')).toBeTruthy();
    expect(within(list).getAllByRole('listitem')).toHaveLength(7);
  });

  it('never fabricates completion counts or percentages', () => {
    const { container } = render(<WeekDayStrip now={new Date('2026-09-24T12:00:00.000Z')} />);
    expect(container.textContent).not.toMatch(/%/);
    expect(container.textContent).not.toMatch(/\d+\s*(de|\/)\s*\d+/);
  });

  it('marks real active days and today from provided consistency days', () => {
    // Thursday (index 3) is today; Monday (0) and Thursday (3) are active.
    render(<WeekDayStrip days={buildDays([0, 3], 3)} />);

    const list = screen.getByRole('list', { name: 'Días de la semana' });
    expect(within(list).getByLabelText('Lunes (activo)')).toBeTruthy();
    expect(within(list).getByLabelText('Jueves (hoy, activo)')).toBeTruthy();
    expect(within(list).getByLabelText('Martes')).toBeTruthy();
    expect(within(list).getByText('HOY')).toBeTruthy();
  });

  it('does not fabricate counts even when marking real active days', () => {
    const { container } = render(<WeekDayStrip days={buildDays([0, 2, 3], 3)} />);
    expect(container.textContent).not.toMatch(/%/);
    expect(container.textContent).not.toMatch(/\d+\s*(de|\/)\s*\d+/);
  });
});
