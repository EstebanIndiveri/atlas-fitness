import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import { ProgressSummaryCard } from './ProgressSummaryCard';

describe('ProgressSummaryCard', () => {
  it('renders completed sessions and total time as sourced metrics', () => {
    render(<ProgressSummaryCard completedSessions={2} totalDurationMinutes={95} />);

    expect(screen.getByRole('heading', { name: 'Resumen' })).toBeTruthy();
    expect(screen.getByLabelText('Sesiones completadas').textContent).toContain('2 sesiones');
    expect(screen.getByLabelText('Tiempo total').textContent).toContain('1h 35m');
  });

  it('handles zero totals without inventing placeholders', () => {
    render(<ProgressSummaryCard completedSessions={0} totalDurationMinutes={0} />);

    expect(screen.getByLabelText('Sesiones completadas').textContent).toContain('0 sesiones');
    expect(screen.getByLabelText('Tiempo total').textContent).toContain('0m');
  });
});
