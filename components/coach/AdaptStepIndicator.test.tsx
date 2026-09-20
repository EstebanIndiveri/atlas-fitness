/**
 * @jest-environment jsdom
 */
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { AdaptStepIndicator } from './AdaptStepIndicator';

describe('AdaptStepIndicator', () => {
  it('renders the three ordered steps and marks the current step accessibly', () => {
    render(<AdaptStepIndicator current="comparacion" />);

    expect(screen.getByRole('list', { name: 'Progreso de adaptación' })).toBeTruthy();
    expect(screen.getByText('1. Motivo')).toBeTruthy();
    expect(screen.getByText('2. Comparación').getAttribute('aria-current')).toBe('step');
    expect(screen.getByText('3. Confirmado')).toBeTruthy();
  });
});
