import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import { TodayHabitsCard } from './TodayHabitsCard';

describe('TodayHabitsCard', () => {
  it('renders the heading and the structural habit preview rows', () => {
    render(<TodayHabitsCard />);
    expect(screen.getByRole('heading', { name: 'Hábitos de hoy' })).toBeTruthy();
    expect(screen.getByText('Hidratación')).toBeTruthy();
    expect(screen.getByText('Caminar')).toBeTruthy();
    expect(screen.getByText('Movilidad')).toBeTruthy();
    expect(screen.getByText('Dormir')).toBeTruthy();
    expect(screen.getAllByText('Próximamente')).toHaveLength(4);
  });

  it('never fabricates habit counts or progress numbers', () => {
    const { container } = render(<TodayHabitsCard />);
    expect(container.textContent).not.toMatch(/\d+\s*(de|\/)\s*\d+/);
    expect(container.textContent).not.toMatch(/%/);
  });
});
