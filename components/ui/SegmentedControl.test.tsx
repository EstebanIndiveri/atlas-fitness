import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

import { SegmentedControl } from './SegmentedControl';

const OPTIONS = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'quarter', label: '3 meses' },
] as const;

describe('SegmentedControl', () => {
  it('renders every option inside an accessible radiogroup', () => {
    render(
      <SegmentedControl
        ariaLabel="Rango de progreso"
        options={OPTIONS}
        value="month"
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByRole('radiogroup', { name: 'Rango de progreso' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Semana' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Mes' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '3 meses' })).toBeTruthy();
  });

  it('marks the selected option with aria-checked', () => {
    render(
      <SegmentedControl
        ariaLabel="Rango de progreso"
        options={OPTIONS}
        value="month"
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByRole('radio', { name: 'Mes' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Semana' }).getAttribute('aria-checked')).toBe('false');
  });

  it('calls onChange when an unselected option is clicked', () => {
    const onChange = jest.fn();
    render(
      <SegmentedControl
        ariaLabel="Rango de progreso"
        options={OPTIONS}
        value="month"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: '3 meses' }));

    expect(onChange).toHaveBeenCalledWith('quarter');
  });

  it('moves selection with arrow keys', () => {
    const onChange = jest.fn();
    render(
      <SegmentedControl
        ariaLabel="Rango de progreso"
        options={OPTIONS}
        value="month"
        onChange={onChange}
      />,
    );

    fireEvent.keyDown(screen.getByRole('radio', { name: 'Mes' }), { key: 'ArrowRight' });
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Mes' }), { key: 'ArrowLeft' });

    expect(onChange).toHaveBeenNthCalledWith(1, 'quarter');
    expect(onChange).toHaveBeenNthCalledWith(2, 'week');
  });

  it('moves keyboard focus to the newly selected option on arrow key', () => {
    render(
      <SegmentedControl
        ariaLabel="Rango de progreso"
        options={OPTIONS}
        value="month"
        onChange={jest.fn()}
      />,
    );

    const monthRadio = screen.getByRole('radio', { name: 'Mes' });
    monthRadio.focus();
    fireEvent.keyDown(monthRadio, { key: 'ArrowRight' });

    expect(document.activeElement).toBe(screen.getByRole('radio', { name: '3 meses' }));
  });
});
