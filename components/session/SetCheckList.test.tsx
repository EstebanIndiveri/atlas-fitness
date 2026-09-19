import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { SetCheckList } from './SetCheckList';

describe('SetCheckList', () => {
  it('keeps the complete-set control labeled and in the thumb-reach cluster', () => {
    render(
      <SetCheckList
        targetSets={3}
        completedCount={0}
        weight="40"
        onWeightChange={jest.fn()}
        onCompleteSet={jest.fn()}
        busy={false}
      />,
    );

    const complete = screen.getByTestId('complete-set-button');
    expect(complete.textContent).toBe('Completar serie');
    expect(complete.className).toContain('min-h-12');
    expect(complete.closest('div')?.className).toContain('bottom-app-cta');
    expect(screen.getByLabelText('Peso (kg)')).toBeTruthy();
  });
});
