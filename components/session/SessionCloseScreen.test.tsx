import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { SessionCloseScreen } from './SessionCloseScreen';
import { MetricSourceLabel } from '@/types/metric';

const baseProps = {
  mood: null,
  onMood: jest.fn(),
  onSave: jest.fn(),
  saving: false,
};

const summary = {
  streak: { currentStreak: 3, longestStreak: 5, lastActiveDate: '2026-09-20' },
  improvements: [],
  stats: {
    durationMinutes: 48,
    completedSets: 2,
    totalVolumeKg: '0.7',
  },
};

describe('SessionCloseScreen', () => {
  it('renders honest close stats with Atlas-computed provenance', () => {
    render(<SessionCloseScreen {...baseProps} summary={summary} muscleGroups={['Pecho', 'Piernas']} />);

    expect(screen.getByText('Pecho · Piernas')).toBeTruthy();
    expect(screen.getByLabelText('Duración').textContent).toContain('48 min');
    expect(screen.getByLabelText('Series').textContent).toContain('2 completadas');
    expect(screen.getByLabelText('Volumen').textContent).toContain('0.7 kg');
    expect(screen.getAllByText(MetricSourceLabel.atlas_computed)).toHaveLength(3);
  });

  it('omits duration when the summary cannot honestly derive it', () => {
    render(
      <SessionCloseScreen
        {...baseProps}
        summary={{
          ...summary,
          stats: { ...summary.stats, durationMinutes: null },
        }}
      />,
    );

    expect(screen.queryByLabelText('Duración')).toBeNull();
    expect(screen.getByLabelText('Series').textContent).toContain('2 completadas');
    expect(screen.getByLabelText('Volumen').textContent).toContain('0.7 kg');
  });
});
