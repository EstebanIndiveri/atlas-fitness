import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

import { HabitPreviewRow, type HabitPreview } from './HabitPreviewRow';

const habit: HabitPreview = {
  id: 'hydration',
  name: 'Hidratación',
  hint: 'Objetivo diario',
  icon: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
};

describe('HabitPreviewRow', () => {
  it('renders the habit identity as a checkbox reflecting the done state', () => {
    render(<HabitPreviewRow habit={habit} done onToggle={jest.fn()} />);

    const control = screen.getByRole('checkbox', { name: /Hidratación/ });
    expect(control.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Objetivo diario')).toBeTruthy();
  });

  it('reflects an un-done habit', () => {
    render(<HabitPreviewRow habit={habit} done={false} onToggle={jest.fn()} />);

    expect(screen.getByRole('checkbox', { name: /Hidratación/ }).getAttribute('aria-checked')).toBe(
      'false',
    );
  });

  it('calls onToggle with the habit key when activated', () => {
    const onToggle = jest.fn();
    render(<HabitPreviewRow habit={habit} done={false} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole('checkbox', { name: /Hidratación/ }));
    expect(onToggle).toHaveBeenCalledWith('hydration');
  });

  it('does not call onToggle when disabled', () => {
    const onToggle = jest.fn();
    render(<HabitPreviewRow habit={habit} done={false} onToggle={onToggle} disabled />);

    fireEvent.click(screen.getByRole('checkbox', { name: /Hidratación/ }));
    expect(onToggle).not.toHaveBeenCalled();
  });
});
