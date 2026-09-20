import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import { TodayHabitsCard } from './TodayHabitsCard';

describe('TodayHabitsCard', () => {
  it('renders the heading and an honest empty state', () => {
    render(<TodayHabitsCard />);
    expect(screen.getByRole('heading', { name: 'Hábitos de hoy' })).toBeTruthy();
    expect(screen.getByText('Todavía no hay hábitos')).toBeTruthy();
  });

  it('never fabricates habit counts or progress numbers', () => {
    const { container } = render(<TodayHabitsCard />);
    expect(container.textContent).not.toMatch(/\d+\s*(de|\/)\s*\d+/);
    expect(container.textContent).not.toMatch(/%/);
  });
});
