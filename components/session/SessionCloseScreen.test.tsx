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
    render(
      <SessionCloseScreen
        {...baseProps}
        summary={summary}
        routineName="Full body exprés"
        muscleGroups={['Pecho', 'Piernas']}
      />,
    );

    expect(screen.getByText('Full body exprés')).toBeTruthy();
    expect(screen.getByLabelText('Duración').textContent).toContain('48 min');
    expect(screen.getByLabelText('Series').textContent).toContain('2 completadas');
    expect(screen.getByLabelText('Volumen').textContent).toContain('0.7 kg');
    expect(screen.getAllByText(MetricSourceLabel.atlas_computed)).toHaveLength(3);
  });

  it('lays out close stats as readable mobile cards instead of cramped three-up cards', () => {
    render(<SessionCloseScreen {...baseProps} summary={summary} />);

    const stats = screen.getByTestId('close-stats');
    expect(stats.className).toContain('grid-cols-1');
    expect(stats.className).toContain('min-[380px]:grid-cols-2');
    expect(screen.getByLabelText('Series').className).toContain('items-start');
    expect(screen.getByLabelText('Volumen').textContent).toContain('0.7 kg');
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

  it.each([
    ['liviano', 'Liviano', 'RPE 6', 6],
    ['normal', 'Normal', 'RPE 7', 7],
    ['exigente', 'Exigente', 'RPE 8.5', 9],
    ['muy-exigente', 'Muy exigente', 'RPE 9.5', 10],
  ] as const)('maps RPE chip %s to the expected effort', (id, label, caption, expectedEffort) => {
    const onEffort = jest.fn();

    render(<SessionCloseScreen {...baseProps} onEffort={onEffort} summary={summary} />);

    const chip = screen.getByTestId(`close-effort-${id}`);
    expect(chip.textContent).toContain(label);
    expect(chip.textContent).toContain(caption);

    fireEvent.click(chip);

    expect(onEffort).toHaveBeenCalledWith(expectedEffort);
  });

  it.each([
    ['bad', 'Agotado', 'bad'],
    ['neutral', 'Normal', 'neutral'],
    ['good', 'Bien', 'good'],
    ['great', 'Muy bien', 'great'],
  ] as const)('maps sensation chip %s to the expected enum', (id, label, expectedSensation) => {
    const onSensation = jest.fn();

    render(<SessionCloseScreen {...baseProps} onSensation={onSensation} summary={summary} />);

    const chip = screen.getByTestId(`close-mood-${id}`);
    expect(chip.textContent).toContain(label);

    fireEvent.click(chip);

    expect(onSensation).toHaveBeenCalledWith(expectedSensation);
  });

  it('captures Figma feedback controls with explicit payload mappings and no note field', () => {
    const onEffort = jest.fn();
    const onSensation = jest.fn();
    const onDiscomfortChange = jest.fn();

    render(
      <SessionCloseScreen
        {...baseProps}
        onEffort={onEffort}
        onSensation={onSensation}
        onDiscomfortChange={onDiscomfortChange}
        summary={summary}
      />,
    );

    expect(screen.getByText('Atlas usa este feedback para calibrar la recuperación y tus próximas cargas.')).toBeTruthy();
    expect(screen.getByTestId('close-effort-exigente').textContent).toContain('RPE 8.5');
    expect(screen.queryByTestId('close-effort-8')).toBeNull();
    expect(screen.getByTestId('close-mood-bad')).toBeTruthy();
    expect(screen.getByTestId('close-mood-neutral')).toBeTruthy();
    expect(screen.getByTestId('close-mood-good')).toBeTruthy();
    expect(screen.getByTestId('close-mood-great')).toBeTruthy();
    expect(screen.queryByTestId('close-mood-hard')).toBeNull();
    expect(screen.queryByLabelText('Nota opcional')).toBeNull();

    fireEvent.click(screen.getByTestId('close-effort-exigente'));
    fireEvent.click(screen.getByTestId('close-mood-good'));
    fireEvent.click(screen.getByRole('button', { name: 'Registrar zona' }));
    fireEvent.change(screen.getByLabelText('Zona con molestia'), { target: { value: 'knee' } });
    fireEvent.change(screen.getByLabelText('Intensidad'), { target: { value: 'moderate' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar molestia' }));

    expect(onEffort).toHaveBeenCalledWith(9);
    expect(onSensation).toHaveBeenCalledWith('good');
    expect(onDiscomfortChange).toHaveBeenCalledWith([{ area: 'knee', intensity: 'moderate' }]);
  });

  it('clears discomfort when the no-pain toggle is selected', () => {
    const onDiscomfortChange = jest.fn();

    render(
      <SessionCloseScreen
        {...baseProps}
        discomfort={[{ area: 'knee', intensity: 'moderate' }]}
        onDiscomfortChange={onDiscomfortChange}
        summary={summary}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'No, todo bien' }));

    expect(onDiscomfortChange).toHaveBeenCalledWith([]);
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

    fireEvent.click(screen.getByRole('button', { name: 'Registrar zona' }));

    expect((screen.getByRole('button', { name: 'Agregar molestia' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar molestia' }));
    expect(onDiscomfortChange).not.toHaveBeenCalled();
  });
});
