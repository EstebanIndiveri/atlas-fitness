import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

import { HydrationHabitRow } from './HydrationHabitRow';
import type { HabitPreview } from './HabitPreviewRow';

const HABIT: HabitPreview = {
  id: 'hydration',
  name: 'Hidratación',
  hint: 'Objetivo diario',
  icon: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
};

describe('HydrationHabitRow', () => {
  it('shows the real logged amount in es-AR liters when present', () => {
    render(
      <HydrationHabitRow habit={HABIT} amount="1.5" onAdd={jest.fn()} onClear={jest.fn()} />,
    );

    expect(screen.getByText('1,5 L')).toBeTruthy();
  });

  it('shows an honest empty label and no reset button when nothing is logged', () => {
    render(<HydrationHabitRow habit={HABIT} amount={null} onAdd={jest.fn()} onClear={jest.fn()} />);

    expect(screen.getByText('Sin registrar hoy')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Reiniciar/ })).toBeNull();
  });

  it('adds a step through onAdd when the add button is pressed', () => {
    const onAdd = jest.fn();
    render(<HydrationHabitRow habit={HABIT} amount={null} onAdd={onAdd} onClear={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Sumar 0,25 L Hidratación/ }));
    expect(onAdd).toHaveBeenCalledWith('hydration');
  });

  it('clears the amount through onClear when reset is pressed', () => {
    const onClear = jest.fn();
    render(<HydrationHabitRow habit={HABIT} amount="1.5" onAdd={jest.fn()} onClear={onClear} />);

    fireEvent.click(screen.getByRole('button', { name: /Reiniciar Hidratación/ }));
    expect(onClear).toHaveBeenCalledWith('hydration');
  });

  it('disables the controls while saving', () => {
    render(
      <HydrationHabitRow habit={HABIT} amount="1.5" onAdd={jest.fn()} onClear={jest.fn()} disabled />,
    );

    expect(screen.getByRole('button', { name: /Sumar/ }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: /Reiniciar/ }).hasAttribute('disabled')).toBe(true);
  });

  it('keeps every action at a 44px tap target without forcing the row wider', () => {
    render(<HydrationHabitRow habit={HABIT} amount="1.5" onAdd={jest.fn()} onClear={jest.fn()} />);

    expect(screen.getByRole('button', { name: /Sumar/ }).className).toContain('min-h-11');
    expect(screen.getByRole('button', { name: /Reiniciar/ }).className).toContain('size-11');
  });

  it('never renders a fabricated target or percentage', () => {
    const { container } = render(
      <HydrationHabitRow habit={HABIT} amount="1.5" onAdd={jest.fn()} onClear={jest.fn()} />,
    );

    expect(container.textContent).not.toMatch(/\d+\s*(de|\/)\s*\d+/);
    expect(container.textContent).not.toMatch(/%/);
  });
});
