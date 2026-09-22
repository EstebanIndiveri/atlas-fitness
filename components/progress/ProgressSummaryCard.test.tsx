import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import { ProgressSummaryCard } from './ProgressSummaryCard';

describe('ProgressSummaryCard', () => {
  it('renders period-aware completed sessions, total time and consistency as sourced metrics', () => {
    render(<ProgressSummaryCard period="month" completedSessions={14} totalDurationMinutes={915} consistencyPercent={88} />);

    expect(screen.getByRole('heading', { name: 'Resumen del mes' })).toBeTruthy();
    expect(screen.getByText('14 sesiones')).toBeTruthy();
    expect(screen.getByLabelText('Sesiones completadas').textContent).toContain('14');
    expect(screen.getByLabelText('Tiempo total').textContent).toContain('15h 15m');
    expect(screen.getByLabelText('Consistencia').textContent).toContain('88%');
    expect(screen.getByText('Cumplís el 88% de tu consistencia semanal esta semana.')).toBeTruthy();
  });

  it('handles zero totals without inventing placeholders', () => {
    render(<ProgressSummaryCard period="week" completedSessions={0} totalDurationMinutes={0} consistencyPercent={null} />);

    expect(screen.getByRole('heading', { name: 'Resumen de la semana' })).toBeTruthy();
    expect(screen.getByLabelText('Sesiones completadas').textContent).toContain('0');
    expect(screen.getByLabelText('Tiempo total').textContent).toContain('0m');
    expect(screen.getByText('Sin datos')).toBeTruthy();
    expect(screen.getByText('Atlas necesita días activos de la semana para calcularla.')).toBeTruthy();
  });

  it('contains long unavailable consistency copy inside equal-height stat cards', () => {
    render(<ProgressSummaryCard period="month" completedSessions={0} totalDurationMinutes={0} consistencyPercent={null} />);

    const stats = screen.getAllByTestId('progress-summary-stat');
    expect(stats).toHaveLength(3);
    for (const stat of stats) {
      expect(stat.className).toContain('min-w-0');
      expect(stat.className).toContain('h-full');
      expect(stat.className).toContain('overflow-hidden');
    }
    expect(screen.getByText('Atlas necesita días activos de la semana para calcularla.').className).toContain('break-words');
  });
});
