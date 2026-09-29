import { afterEach, describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react';

declare const jest: typeof import('@jest/globals').jest;

jest.mock('@/hooks/useHabits', () => ({ useHabits: jest.fn() }));
jest.mock('@/hooks/useHabitTargets', () => ({ useHabitTargets: jest.fn() }));
jest.mock('@/hooks/useHabitAdherence', () => ({ useHabitAdherence: jest.fn() }));

import { useHabitAdherence as useHabitAdherenceHook } from '@/hooks/useHabitAdherence';
import { useHabitTargets as useHabitTargetsHook } from '@/hooks/useHabitTargets';
import { useHabits as useHabitsHook } from '@/hooks/useHabits';
import { HABIT_TARGET_COPY } from '@/lib/copy/habit-targets';
import type { UseHabitTargetsResult } from '@/hooks/useHabitTargets';
import type { HabitTargetResponse } from '@/lib/api/habit-targets';
import type { HabitKey } from '@/types/habit';
import { HabitsScreen } from './HabitsScreen';

const useHabits = jest.mocked(useHabitsHook);
const useHabitTargets = jest.mocked(useHabitTargetsHook);
const useHabitAdherence = jest.mocked(useHabitAdherenceHook);

function mockHabits() {
  const toggle = jest.fn<ReturnType<typeof useHabitsHook>['toggle']>().mockResolvedValue(undefined);
  useHabits.mockReturnValue({
    doneByKey: { hydration: false, walk: true, mobility: false, sleep: false },
    amountByKey: { hydration: null, walk: null, mobility: null, sleep: null },
    loading: false,
    saving: false,
    error: null,
    reload: jest.fn(),
    toggle,
    addAmount: jest.fn<ReturnType<typeof useHabitsHook>['addAmount']>().mockResolvedValue(undefined),
    clearAmount: jest
      .fn<ReturnType<typeof useHabitsHook>['clearAmount']>()
      .mockResolvedValue(undefined),
  });
  return { toggle };
}

function walkTarget(): HabitTargetResponse {
  return {
    id: 7,
    userId: 1,
    habitKey: 'walk',
    effectiveFrom: '2026-09-24',
    effectiveTo: null,
    version: 1,
    weekdays: [4],
    createdAt: '2026-09-24T15:00:00.000Z',
    updatedAt: '2026-09-24T15:00:00.000Z',
  };
}

function mockTargets(expected: Partial<Record<HabitKey, boolean>> = {}) {
  const value: UseHabitTargetsResult = {
    targets: {
      hydration: null,
      walk: walkTarget(),
      mobility: null,
      sleep: null,
    },
    expectedTodayByKey: {
      hydration: false,
      walk: false,
      mobility: false,
      sleep: false,
      ...expected,
    },
    configuredCount: 1,
    loading: false,
    saving: false,
    error: null,
    revision: 0,
    reload: jest.fn(),
    save: jest
      .fn<UseHabitTargetsResult['save']>()
      .mockResolvedValue(true),
    deactivate: jest.fn<UseHabitTargetsResult['deactivate']>().mockResolvedValue(true),
  };
  useHabitTargets.mockReturnValue(value);
  return value;
}

describe('HabitsScreen target loop', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('marks the objective of today without hiding or disabling extra habits', () => {
    const { toggle } = mockHabits();
    mockTargets({ walk: true });
    useHabitAdherence.mockReturnValue({
      adherence: null,
      loading: true,
      error: null,
      reload: jest.fn(),
    });

    render(<HabitsScreen />);

    const list = screen.getByTestId('habits-list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    // Only the expected habit carries the marker.
    expect(within(list).getAllByText(HABIT_TARGET_COPY.objectiveToday)).toHaveLength(1);
    expect(
      within(list)
        .getByRole('checkbox', { name: 'Pasos Activos' })
        .closest('li')
        ?.textContent,
    ).toContain(HABIT_TARGET_COPY.objectiveToday);

    // A non-expected habit is still loggable.
    const sleep = within(list).getByRole('checkbox', { name: 'Descanso & Sueño' });
    expect(sleep.hasAttribute('disabled')).toBe(false);
    fireEvent.click(sleep);
    expect(toggle).toHaveBeenCalledWith('sleep');
  });

  it('renders the configuration and read-back loop below today’s list', () => {
    mockHabits();
    mockTargets();
    useHabitAdherence.mockReturnValue({
      adherence: null,
      loading: true,
      error: null,
      reload: jest.fn(),
    });

    render(<HabitsScreen />);

    expect(screen.getByRole('heading', { name: HABIT_TARGET_COPY.sectionTitle })).toBeTruthy();
    expect(screen.getByRole('heading', { name: HABIT_TARGET_COPY.historyTitle })).toBeTruthy();
  });
});
