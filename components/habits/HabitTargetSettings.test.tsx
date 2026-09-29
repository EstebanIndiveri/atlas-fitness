import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { HABIT_TARGET_COPY } from '@/lib/copy/habit-targets';
import { HabitTargetSettings } from './HabitTargetSettings';
import type { HabitTargetResponse } from '@/lib/api/habit-targets';
import type { UseHabitTargetsResult } from '@/hooks/useHabitTargets';
import type { HabitKey } from '@/types/habit';
import type { HabitTargetWeekday } from '@/types/habit-target';

function emptyTargets(): Record<HabitKey, HabitTargetResponse | null> {
  return { hydration: null, walk: null, mobility: null, sleep: null };
}

function emptyExpected(): Record<HabitKey, boolean> {
  return { hydration: false, walk: false, mobility: false, sleep: false };
}

function walkTarget(overrides: Partial<HabitTargetResponse> = {}): HabitTargetResponse {
  return {
    id: 7,
    userId: 1,
    habitKey: 'walk',
    effectiveFrom: '2026-09-24',
    effectiveTo: null,
    version: 1,
    weekdays: [1, 3],
    createdAt: '2026-09-24T15:00:00.000Z',
    updatedAt: '2026-09-24T15:00:00.000Z',
    ...overrides,
  };
}

function result(overrides: Partial<UseHabitTargetsResult> = {}): UseHabitTargetsResult {
  return {
    targets: emptyTargets(),
    expectedTodayByKey: emptyExpected(),
    configuredCount: 0,
    loading: false,
    saving: false,
    error: null,
    revision: 0,
    reload: jest.fn(),
    save: jest
      .fn<(habitKey: HabitKey, weekdays: readonly HabitTargetWeekday[]) => Promise<boolean>>()
      .mockResolvedValue(true),
    deactivate: jest.fn<(habitKey: HabitKey) => Promise<boolean>>().mockResolvedValue(true),
    ...overrides,
  };
}

function walkRow(): HTMLElement {
  return screen.getByTestId('habit-target-row-walk');
}

describe('HabitTargetSettings', () => {
  it('starts a fresh user with the honest not-configured empty state', () => {
    render(<HabitTargetSettings targets={result()} />);

    expect(screen.getByRole('heading', { name: HABIT_TARGET_COPY.sectionTitle })).toBeTruthy();
    expect(screen.getByText(HABIT_TARGET_COPY.notConfigured)).toBeTruthy();
    expect(screen.getByText(HABIT_TARGET_COPY.effectiveFromToday)).toBeTruthy();
    expect(screen.getByText(HABIT_TARGET_COPY.pastPreserved)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: HABIT_TARGET_COPY.save })).toHaveLength(4);
  });

  it('shows a loading state without any save control', () => {
    render(<HabitTargetSettings targets={result({ loading: true })} />);

    expect(screen.getByTestId('habit-target-settings-loading').textContent).toBe(
      HABIT_TARGET_COPY.loading,
    );
    expect(screen.queryByRole('button', { name: HABIT_TARGET_COPY.save })).toBeNull();
  });

  it('shows the load error and retries without dropping the panel', () => {
    const targets = result({
      error: { kind: 'generic', message: HABIT_TARGET_COPY.loadError },
    });
    render(<HabitTargetSettings targets={targets} />);

    expect(screen.getByTestId('habit-target-settings-error').textContent).toContain(
      HABIT_TARGET_COPY.loadError,
    );
    fireEvent.click(screen.getByRole('button', { name: HABIT_TARGET_COPY.retry }));
    expect(targets.reload).toHaveBeenCalledTimes(1);
  });

  it('shows the vigencia summary and the objective-today marker for a configured habit', () => {
    render(
      <HabitTargetSettings
        targets={result({
          targets: { ...emptyTargets(), walk: walkTarget({ weekdays: [1, 3] }) },
          expectedTodayByKey: { ...emptyExpected(), walk: true },
          configuredCount: 1,
        })}
      />,
    );

    const row = walkRow();
    expect(within(row).getByText(HABIT_TARGET_COPY.configuredSummary('Lunes, Miércoles'))).toBeTruthy();
    expect(within(row).getByTestId('habit-target-today-walk').textContent).toBe(
      HABIT_TARGET_COPY.objectiveToday,
    );
  });

  it('does not mark a configured habit as objective today when today is not selected', () => {
    render(
      <HabitTargetSettings
        targets={result({
          targets: { ...emptyTargets(), walk: walkTarget({ weekdays: [1, 3] }) },
          expectedTodayByKey: emptyExpected(),
          configuredCount: 1,
        })}
      />,
    );

    expect(within(walkRow()).queryByTestId('habit-target-today-walk')).toBeNull();
  });

  it('edits a habit draft and saves the sorted Sunday-first selection', () => {
    const targets = result();
    render(<HabitTargetSettings targets={targets} />);

    const row = walkRow();
    fireEvent.click(within(row).getByRole('button', { name: 'Domingo' }));
    fireEvent.click(within(row).getByRole('button', { name: 'Lunes' }));
    fireEvent.click(within(row).getByRole('button', { name: HABIT_TARGET_COPY.save }));

    expect(targets.save).toHaveBeenCalledWith('walk', [0, 1]);
  });

  it('blocks saving while no weekday is selected and states why', () => {
    const targets = result();
    render(<HabitTargetSettings targets={targets} />);

    const row = walkRow();
    expect(within(row).getByText(HABIT_TARGET_COPY.noDaysSelected)).toBeTruthy();

    fireEvent.click(within(row).getByRole('button', { name: HABIT_TARGET_COPY.save }));
    expect(targets.save).not.toHaveBeenCalled();
  });

  it('requires an explicit confirmation before deactivating and keeps the target on cancel', () => {
    const targets = result({
      targets: { ...emptyTargets(), walk: walkTarget() },
      expectedTodayByKey: { ...emptyExpected(), walk: true },
      configuredCount: 1,
    });
    render(<HabitTargetSettings targets={targets} />);

    const row = walkRow();
    fireEvent.click(within(row).getByRole('button', { name: HABIT_TARGET_COPY.deactivate }));

    expect(within(row).getByText(HABIT_TARGET_COPY.confirmDeactivateTitle)).toBeTruthy();
    expect(within(row).getByText(HABIT_TARGET_COPY.confirmDeactivateBody)).toBeTruthy();

    fireEvent.click(within(row).getByRole('button', { name: HABIT_TARGET_COPY.cancel }));
    expect(targets.deactivate).not.toHaveBeenCalled();
    expect(within(row).queryByText(HABIT_TARGET_COPY.confirmDeactivateTitle)).toBeNull();
  });

  it('deactivates only after the confirmation is accepted', () => {
    const targets = result({
      targets: { ...emptyTargets(), walk: walkTarget() },
      expectedTodayByKey: { ...emptyExpected(), walk: true },
      configuredCount: 1,
    });
    render(<HabitTargetSettings targets={targets} />);

    const row = walkRow();
    fireEvent.click(within(row).getByRole('button', { name: HABIT_TARGET_COPY.deactivate }));
    fireEvent.click(within(row).getByRole('button', { name: HABIT_TARGET_COPY.confirmDeactivate }));

    expect(targets.deactivate).toHaveBeenCalledWith('walk');
  });

  it('states the stale conflict and preserves the server target while offering a reload', () => {
    const targets = result({
      targets: { ...emptyTargets(), walk: walkTarget() },
      expectedTodayByKey: { ...emptyExpected(), walk: true },
      configuredCount: 1,
      error: { kind: 'conflict', message: HABIT_TARGET_COPY.conflict },
    });
    render(<HabitTargetSettings targets={targets} />);

    expect(screen.getByTestId('habit-target-settings-error').textContent).toContain(
      HABIT_TARGET_COPY.conflict,
    );
    expect(
      within(walkRow()).getByText(HABIT_TARGET_COPY.configuredSummary('Lunes, Miércoles')),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: HABIT_TARGET_COPY.retry }));
    expect(targets.reload).toHaveBeenCalledTimes(1);
  });

  it('keeps the loaded selection visible when a generic error arrives', () => {
    const targets = result({
      targets: { ...emptyTargets(), walk: walkTarget({ weekdays: [2, 4] }) },
      expectedTodayByKey: { ...emptyExpected(), walk: true },
      configuredCount: 1,
      error: { kind: 'generic', message: HABIT_TARGET_COPY.saveError },
    });
    render(<HabitTargetSettings targets={targets} />);

    const row = walkRow();
    expect(within(row).getByText(HABIT_TARGET_COPY.configuredSummary('Martes, Jueves'))).toBeTruthy();
    expect(within(row).getByRole('button', { name: HABIT_TARGET_COPY.save })).toBeTruthy();
  });

  it('disables controls while saving to avoid a double mutation', () => {
    const targets = result({
      targets: { ...emptyTargets(), walk: walkTarget() },
      expectedTodayByKey: { ...emptyExpected(), walk: true },
      configuredCount: 1,
      saving: true,
    });
    render(<HabitTargetSettings targets={targets} />);

    expect(
      within(walkRow()).getByRole('button', { name: HABIT_TARGET_COPY.save }).hasAttribute('disabled'),
    ).toBe(true);
  });
});
