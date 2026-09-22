import { beforeEach, describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

declare const jest: typeof import('@jest/globals').jest;

jest.mock('@/hooks/useProgress', () => ({ useProgress: jest.fn() }));
jest.mock('@/hooks/useDailyCheckin', () => ({ useDailyCheckin: jest.fn() }));
jest.mock('@/hooks/useHabits', () => ({ useHabits: jest.fn() }));

import { useDailyCheckin as useDailyCheckinHook } from '@/hooks/useDailyCheckin';
import { useHabits as useHabitsHook } from '@/hooks/useHabits';
import { useProgress as useProgressHook } from '@/hooks/useProgress';
import ProgressPage from './page';

const useProgress = jest.mocked(useProgressHook);
const useDailyCheckin = jest.mocked(useDailyCheckinHook);
const useHabits = jest.mocked(useHabitsHook);

const setPeriod = jest.fn<(period: 'week' | 'month' | 'quarter') => void>();

const week = {
  weekStart: '2026-09-14',
  weekEnd: '2026-09-20',
  activeCount: 4,
  days: Array.from({ length: 7 }, (_, index) => ({
    date: `2026-09-${String(14 + index).padStart(2, '0')}`,
    weekdayIndex: index,
    active: index < 4,
    isToday: index === 6,
    isFuture: false,
  })),
};

function mockSideHooks(): void {
  useDailyCheckin.mockReturnValue({
    checkin: null,
    loading: false,
    saving: false,
    error: null,
    reload: jest.fn(),
    submit: jest.fn<ReturnType<typeof useDailyCheckinHook>['submit']>().mockResolvedValue(null),
  });
  useHabits.mockReturnValue({
    doneByKey: { hydration: false, walk: false, mobility: false, sleep: false },
    amountByKey: { hydration: null, walk: null, mobility: null, sleep: null },
    loading: false,
    saving: false,
    error: null,
    reload: jest.fn(),
    toggle: jest.fn<ReturnType<typeof useHabitsHook>['toggle']>().mockResolvedValue(undefined),
    addAmount: jest.fn<ReturnType<typeof useHabitsHook>['addAmount']>().mockResolvedValue(undefined),
    clearAmount: jest.fn<ReturnType<typeof useHabitsHook>['clearAmount']>().mockResolvedValue(undefined),
  });
}

describe('ProgressPage', () => {
  beforeEach(() => {
    setPeriod.mockClear();
    mockSideHooks();
  });

  it('renders loading state before data is available', () => {
    useProgress.mockReturnValue({ summary: null, week: null, loading: true, error: null, period: 'month', setPeriod });

    render(<ProgressPage />);

    expect(screen.getByRole('status').textContent).toContain('Cargando');
    expect(screen.getByRole('heading', { name: 'Progreso' })).toBeTruthy();
  });

  it('renders error state without summary cards', () => {
    useProgress.mockReturnValue({ summary: null, week: null, loading: false, error: 'No pudimos cargar tu progreso.', period: 'month', setPeriod });

    render(<ProgressPage />);

    expect(screen.getByRole('alert').textContent).toContain('No pudimos cargar tu progreso.');
    expect(screen.queryByRole('heading', { name: 'Resumen del mes' })).toBeNull();
  });

  it('renders populated progress sections and honest unavailable-data states', () => {
    useProgress.mockReturnValue({
      loading: false,
      error: null,
      period: 'month',
      setPeriod,
      week,
      summary: {
        period: 'month',
        fromLocalDate: '2026-09-01',
        toLocalDate: '2026-09-30',
        completedSessions: 14,
        totalDurationMinutes: 915,
        strength: { hasLoggedSets: false, latestVolumeKg: null, trendLabel: 'Sin datos de fuerza', points: [] },
        sessions: [{ workoutId: 3, startedAt: '2026-09-20T12:00:00.000Z', durationMinutes: 50, routineName: 'Empuje' }],
      },
    });

    render(<ProgressPage />);

    expect(screen.getByRole('radiogroup', { name: 'Rango de progreso' }).className).toContain('rounded-full');
    expect(screen.getByRole('radio', { name: 'Mes' }).className).toContain('bg-ink');
    expect(screen.getByRole('heading', { name: 'Interpretación de Atlas' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Resumen del mes' })).toBeTruthy();
    expect(screen.getByLabelText('Consistencia').textContent).toContain('Sin datos');
    expect(screen.getByRole('heading', { name: 'Consistencia semanal' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Evolución de fuerza' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Bienestar registrado' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Hábitos consistentes' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Sesiones recientes' })).toBeTruthy();
    expect(screen.getByText('Todavía no hay series completadas para graficar tu fuerza.')).toBeTruthy();
  });

  it('renders weekly consistency in the period summary only for the week period', () => {
    useProgress.mockReturnValue({
      loading: false,
      error: null,
      period: 'week',
      setPeriod,
      week,
      summary: {
        period: 'week',
        fromLocalDate: '2026-09-14',
        toLocalDate: '2026-09-20',
        completedSessions: 2,
        totalDurationMinutes: 120,
        strength: {
          hasLoggedSets: true,
          latestVolumeKg: '810',
          trendLabel: 'Punto de partida',
          points: [{
            workoutId: 3,
            startedAt: '2026-09-20T12:00:00.000Z',
            localDate: '2026-09-20',
            totalVolumeKg: '810',
            completedSets: 4,
          }],
        },
        sessions: [],
      },
    });

    render(<ProgressPage />);

    expect(screen.getByRole('heading', { name: 'Resumen de la semana' })).toBeTruthy();
    expect(screen.getByLabelText('Consistencia').textContent).toContain('57%');
    expect(screen.getByLabelText('Volumen de la última sesión').textContent).toContain('810 kg');
  });

  it('renders empty state when progress summary has no sessions', () => {
    useProgress.mockReturnValue({
      loading: false,
      error: null,
      period: 'week',
      setPeriod,
      week: { ...week, activeCount: 0 },
      summary: {
        period: 'week',
        fromLocalDate: '2026-09-14',
        toLocalDate: '2026-09-20',
        completedSessions: 0,
        totalDurationMinutes: 0,
        strength: { hasLoggedSets: false, latestVolumeKg: null, trendLabel: 'Sin datos de fuerza', points: [] },
        sessions: [],
      },
    });

    render(<ProgressPage />);

    expect(screen.getByText('Todavía no hay suficientes datos reales para interpretar una tendencia. Registrá sesiones o check-ins y Atlas va a leerlos acá.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Todavía no hay entrenos' })).toBeTruthy();
  });

  it('wires period tabs to the progress hook', () => {
    useProgress.mockReturnValue({ summary: null, week: null, loading: true, error: null, period: 'month', setPeriod });

    render(<ProgressPage />);
    fireEvent.click(screen.getByRole('radio', { name: '3 meses' }));

    expect(setPeriod).toHaveBeenCalledWith('quarter');
  });
});
