import { describe, expect, it } from '@jest/globals';
import { render, screen, within } from '@testing-library/react';

import { WeekDayStrip } from './WeekDayStrip';

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
});
