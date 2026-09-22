import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import { TodayHeader } from './TodayHeader';

const FIXED = new Date('2026-09-24T12:00:00.000Z');

describe('TodayHeader', () => {
  it('greets the user by name and shows the subtitle', () => {
    render(<TodayHeader name="Esteban" now={FIXED} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Hola, Esteban');
    expect(screen.getByTestId('welcome-message').textContent).toBe('Hola, Esteban');
    expect(screen.getByText('ATLAS ADAPTIVE')).toBeTruthy();
    expect(screen.getByText('Atlas')).toBeTruthy();
    expect(screen.getByLabelText('Notificaciones')).toBeTruthy();
  });

  it('falls back to a nameless greeting when name is null', () => {
    render(<TodayHeader name={null} now={FIXED} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Hola');
    expect(screen.getByLabelText('Avatar de Atlas').textContent).toBe('◎');
  });

  it('renders the Córdoba display date', () => {
    render(<TodayHeader name="Ana" now={FIXED} />);
    expect(screen.getByText(/jueves, 24 de septiembre/i)).toBeTruthy();
  });

  it('derives avatar initials from the loaded profile name without hardcoding QA', () => {
    render(<TodayHeader name="QA Test User" now={FIXED} />);
    expect(screen.getByLabelText('Avatar de QA Test User').textContent).toBe('◎ QT');
  });
});
