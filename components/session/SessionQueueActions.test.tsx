/**
 * @jest-environment jsdom
 */
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { SESSION_COPY } from '@/lib/copy/session';
import { SessionQueueActions } from './SessionQueueActions';

const items = [
  { exerciseId: 10, name: 'Press Banca', current: true, held: false },
  { exerciseId: 20, name: 'Sentadilla', current: false, held: false },
  { exerciseId: 30, name: 'Remo', current: false, held: true },
];

describe('SessionQueueActions', () => {
  it('renders skip/hold controls with accessible names and keyboard-focusable buttons', () => {
    const onSkip = jest.fn();
    const onHold = jest.fn();
    render(
      <SessionQueueActions items={items} onSkip={onSkip} onHold={onHold} busy={false} error={null} />,
    );

    const skip = screen.getByTestId('session-skip');
    const hold = screen.getByTestId('session-hold');
    expect(skip.tagName).toBe('BUTTON');
    expect(hold.tagName).toBe('BUTTON');
    expect(skip.getAttribute('aria-label')).toBe(SESSION_COPY.skipExerciseAria);
    expect(hold.getAttribute('aria-label')).toBe(SESSION_COPY.holdExerciseAria);
    expect(skip.getAttribute('tabindex')).not.toBe('-1');
    expect(hold.getAttribute('tabindex')).not.toBe('-1');

    skip.focus();
    expect(document.activeElement).toBe(skip);
    fireEvent.click(skip);
    fireEvent.click(hold);
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onHold).toHaveBeenCalledTimes(1);
    expect(screen.getByText(SESSION_COPY.queueHeld)).toBeTruthy();
  });

  it('shows a clear error when the workout is not active', () => {
    render(
      <SessionQueueActions
        items={items}
        onSkip={jest.fn()}
        onHold={jest.fn()}
        busy={false}
        error={SESSION_COPY.errorNotActive}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe(SESSION_COPY.errorNotActive);
    expect(alert.getAttribute('data-testid')).toBe('session-queue-error');
  });
});
