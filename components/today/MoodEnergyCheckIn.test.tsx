import { afterEach, describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

declare const jest: typeof import('@jest/globals').jest;

import type { DailyCheckInResponse } from '@/lib/api/checkin';

jest.mock('@/hooks/useDailyCheckin', () => ({
  useDailyCheckin: jest.fn(),
}));

import { useDailyCheckin as useDailyCheckinHook } from '@/hooks/useDailyCheckin';
import { MoodEnergyCheckIn } from './MoodEnergyCheckIn';

const useDailyCheckin = jest.mocked(useDailyCheckinHook);

const recordedCheckin: DailyCheckInResponse = {
  id: 1,
  userId: 2,
  localDate: '2026-09-20',
  mood: 4,
  energy: 'high',
  note: null,
  createdAt: '2026-09-20T10:00:00.000Z',
  updatedAt: '2026-09-20T10:00:00.000Z',
};

function mockCheckin(overrides: Partial<ReturnType<typeof useDailyCheckinHook>> = {}) {
  const submit = jest.fn<ReturnType<typeof useDailyCheckinHook>['submit']>().mockResolvedValue(recordedCheckin);
  const reload = jest.fn<ReturnType<typeof useDailyCheckinHook>['reload']>();
  const value: ReturnType<typeof useDailyCheckinHook> = {
    checkin: null,
    loading: false,
    saving: false,
    error: null,
    reload,
    submit,
    ...overrides,
  };
  useDailyCheckin.mockReturnValue(value);
  return { submit, reload };
}

describe('MoodEnergyCheckIn', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the Figma mood prompt with four honest mood choices and three energy pills', () => {
    mockCheckin();

    render(<MoodEnergyCheckIn />);

    expect(screen.getByRole('heading', { name: '¿Cómo te sentís hoy?' })).toBeTruthy();
    expect(screen.getByText('⚡ Sin registrar energía')).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(screen.getByRole('radio', { name: 'Agotado' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Normal' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Con energía' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Excelente' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Con energía' }).querySelector('svg')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Seleccionar energía Baja' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Seleccionar energía Media' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Seleccionar energía Alta' })).toBeTruthy();
  });

  it('does not fabricate an energy percentage from the low/medium/high check-in enum', () => {
    mockCheckin({ checkin: { ...recordedCheckin, energy: 'high' } });

    const { container } = render(<MoodEnergyCheckIn />);

    expect(screen.getByText('⚡ Alta energía')).toBeTruthy();
    expect(container.textContent).not.toMatch(/\d+%/);
  });

  it('renders the compact loading state while loading', () => {
    mockCheckin({ loading: true });

    render(<MoodEnergyCheckIn />);

    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('renders an inline error state without removing controls', () => {
    mockCheckin({ error: 'No se pudo guardar el check-in' });

    render(<MoodEnergyCheckIn />);

    expect(screen.getByRole('alert').textContent).toContain('No se pudo guardar el check-in');
    expect(screen.getByRole('radio', { name: 'Con energía' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: 'Seleccionar energía Alta' }).hasAttribute('disabled')).toBe(false);
  });

  it('submits the tapped mood with the known energy value', () => {
    const { submit } = mockCheckin({ checkin: { ...recordedCheckin, energy: 'medium' } });

    render(<MoodEnergyCheckIn />);
    fireEvent.click(screen.getByRole('radio', { name: 'Excelente' }));

    expect(submit).toHaveBeenCalledWith({ mood: 5, energy: 'medium' });
  });

  it('submits tapped energy with the known mood value', () => {
    const { submit } = mockCheckin({ checkin: recordedCheckin });

    render(<MoodEnergyCheckIn />);
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar energía Baja' }));

    expect(submit).toHaveBeenCalledWith({ mood: 4, energy: 'low' });
  });

  it('reflects persisted mood and energy as selected controls', () => {
    mockCheckin({ checkin: recordedCheckin });

    render(<MoodEnergyCheckIn />);

    const selectedMood = screen.getByRole('radio', { name: 'Con energía' });
    expect(selectedMood.getAttribute('aria-checked')).toBe('true');
    expect(selectedMood.className).toContain('bg-brand');
    expect(selectedMood.className).toContain('text-white');
    expect(selectedMood.className).not.toContain('bg-canvas');
    expect(selectedMood.querySelector('svg')?.className.baseVal).toContain('text-white');
    expect(screen.getByRole('button', { name: 'Seleccionar energía Alta' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('⚡ Alta energía')).toBeTruthy();
  });


  it('moves and saves mood selection with arrow keys inside the radiogroup', () => {
    const { submit } = mockCheckin({ checkin: { ...recordedCheckin, mood: 3, energy: 'medium' } });

    render(<MoodEnergyCheckIn />);
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Normal' }), { key: 'ArrowRight' });

    expect(submit).toHaveBeenCalledWith({ mood: 1, energy: 'medium' });
    expect(screen.getByRole('radio', { name: 'Agotado' }).getAttribute('aria-checked')).toBe('true');
  });

  it('does not fabricate a mood when energy is tapped first', () => {
    const { submit } = mockCheckin();

    render(<MoodEnergyCheckIn />);
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar energía Media' }));

    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByText('Elegí tu ánimo primero')).toBeTruthy();
  });

  it('disables mood and energy inputs while saving', () => {
    mockCheckin({ saving: true, checkin: recordedCheckin });

    render(<MoodEnergyCheckIn />);

    expect(screen.getByRole('radio', { name: 'Con energía' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Seleccionar energía Alta' }).hasAttribute('disabled')).toBe(true);
  });
});
