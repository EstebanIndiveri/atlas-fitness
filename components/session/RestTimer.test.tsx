import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { RestTimer } from './RestTimer';

describe('RestTimer', () => {
  it('shows suggested rest in mm:ss with progress controls', () => {
    const onSkip = jest.fn();
    const onAddThirtySeconds = jest.fn();
    render(
      <RestTimer
        remaining={90}
        totalSeconds={120}
        motivator="Bien. Respirá y prepará la próxima."
        onSkip={onSkip}
        onAddThirtySeconds={onAddThirtySeconds}
      />,
    );
    expect(screen.getByText('DESCANSO SUGERIDO')).toBeTruthy();
    expect(screen.getByTestId('rest-timer').textContent).toBe('01:30');
    expect(screen.getByTestId('rest-motivator').textContent).toMatch(/Respirá/);
    expect(screen.getByTestId('rest-progress').getAttribute('aria-valuenow')).toBe('75');
    screen.getByRole('button', { name: 'Sumar 30 segundos al descanso' }).click();
    expect(onAddThirtySeconds).toHaveBeenCalled();
    screen.getByRole('button', { name: 'Saltar descanso' }).click();
    expect(onSkip).toHaveBeenCalled();
  });
});
