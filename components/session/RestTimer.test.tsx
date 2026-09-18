import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { RestTimer } from './RestTimer';

describe('RestTimer', () => {
  it('shows remaining seconds and skip control', () => {
    const onSkip = jest.fn();
    render(<RestTimer remaining={42} motivator="Bien. Respirá y prepará la próxima." onSkip={onSkip} />);
    expect(screen.getByTestId('rest-timer').textContent).toBe('42s');
    expect(screen.getByTestId('rest-motivator').textContent).toMatch(/Respirá/);
    screen.getByRole('button', { name: 'Saltar descanso' }).click();
    expect(onSkip).toHaveBeenCalled();
  });
});
