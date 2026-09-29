import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

import { HABIT_TARGET_COPY } from '@/lib/copy/habit-targets';
import { HabitTargetWeekdaySelector } from './HabitTargetWeekdaySelector';
import type { HabitTargetWeekday } from '@/types/habit-target';

describe('HabitTargetWeekdaySelector', () => {
  it('renders the seven weekdays from Monday to Sunday with accessible names', () => {
    render(
      <HabitTargetWeekdaySelector habitName="Pasos Activos" selected={[]} onChange={jest.fn()} />,
    );

    const group = screen.getByRole('group', { name: HABIT_TARGET_COPY.weekdayGroupAria('Pasos Activos') });
    const labels = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    labels.forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    });
    expect(group.className).toContain('flex-wrap');
    expect(group.className).toContain('min-w-0');
  });

  it('reflects the Sunday-first domain selection, including Sunday as 0', () => {
    render(<HabitTargetWeekdaySelector habitName="Pasos Activos" selected={[0, 4]} onChange={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Domingo' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Jueves' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Lunes' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('adds a weekday as a sorted Sunday-first domain value when toggled on', () => {
    const onChange = jest.fn<(weekdays: HabitTargetWeekday[]) => void>();
    render(<HabitTargetWeekdaySelector habitName="Movilidad" selected={[0]} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Lunes' }));

    expect(onChange).toHaveBeenCalledWith([0, 1]);
  });

  it('removes a weekday from the sorted domain values when toggled off', () => {
    const onChange = jest.fn<(weekdays: HabitTargetWeekday[]) => void>();
    render(<HabitTargetWeekdaySelector habitName="Movilidad" selected={[1, 4]} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Jueves' }));

    expect(onChange).toHaveBeenCalledWith([1]);
  });

  it('disables every toggle while a save is in flight', () => {
    render(
      <HabitTargetWeekdaySelector
        habitName="Movilidad"
        selected={[1]}
        onChange={jest.fn()}
        disabled
      />,
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(7);
    buttons.forEach((button) => {
      expect(button.hasAttribute('disabled')).toBe(true);
      expect(button.className).toContain('min-h-11');
    });
  });
});
