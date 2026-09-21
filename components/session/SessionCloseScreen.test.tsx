import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { SessionCloseScreen } from './SessionCloseScreen';
import { MetricSourceLabel } from '@/types/metric';
import type { DiscomfortEntry, WorkoutSensation } from '@/lib/services/post-workout-feedback';

const baseProps = {
  effort: null,
  onEffort: jest.fn(),
  sensation: null,
  onSensation: jest.fn(),
  discomfort: [] as DiscomfortEntry[],
  onDiscomfortChange: jest.fn(),
  note: '',
  onNoteChange: jest.fn(),
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

  it('keeps save disabled until effort and sensation are selected', () => {
    const { rerender } = render(<SessionCloseScreen {...baseProps} summary={summary} />);

    expect((screen.getByTestId('close-save') as HTMLButtonElement).disabled).toBe(true);

    rerender(<SessionCloseScreen {...baseProps} effort={7} summary={summary} />);
    expect((screen.getByTestId('close-save') as HTMLButtonElement).disabled).toBe(true);

    rerender(
      <SessionCloseScreen
        {...baseProps}
        effort={7}
        sensation={'good' as WorkoutSensation}
        summary={summary}
      />,
    );
    expect((screen.getByTestId('close-save') as HTMLButtonElement).disabled).toBe(false);
  });

  it('captures effort, sensation, discomfort, and note accessibly', () => {
    const onEffort = jest.fn();
    const onSensation = jest.fn();
    const onDiscomfortChange = jest.fn();
    const onNoteChange = jest.fn();

    render(
      <SessionCloseScreen
        {...baseProps}
        onEffort={onEffort}
        onSensation={onSensation}
        onDiscomfortChange={onDiscomfortChange}
        onNoteChange={onNoteChange}
        summary={summary}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Esfuerzo 8 de 10' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bien' }));
    fireEvent.change(screen.getByLabelText('Zona con molestia'), { target: { value: 'knee' } });
    fireEvent.change(screen.getByLabelText('Intensidad'), { target: { value: 'moderate' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar molestia' }));
    fireEvent.change(screen.getByLabelText('Nota opcional'), { target: { value: 'Cuidar rodilla.' } });

    expect(onEffort).toHaveBeenCalledWith(8);
    expect(onSensation).toHaveBeenCalledWith('good');
    expect(onDiscomfortChange).toHaveBeenCalledWith([{ area: 'knee', intensity: 'moderate' }]);
    expect(onNoteChange).toHaveBeenCalledWith('Cuidar rodilla.');
  });

  it('enforces the five discomfort entries limit client-side', () => {
    const onDiscomfortChange = jest.fn();
    const fiveEntries: DiscomfortEntry[] = [
      { area: 'neck', intensity: 'mild' },
      { area: 'shoulder', intensity: 'mild' },
      { area: 'back', intensity: 'moderate' },
      { area: 'hip', intensity: 'moderate' },
      { area: 'knee', intensity: 'strong' },
    ];

    render(
      <SessionCloseScreen
        {...baseProps}
        discomfort={fiveEntries}
        onDiscomfortChange={onDiscomfortChange}
        summary={summary}
      />,
    );

    expect((screen.getByRole('button', { name: 'Agregar molestia' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar molestia' }));
    expect(onDiscomfortChange).not.toHaveBeenCalled();
  });
});
