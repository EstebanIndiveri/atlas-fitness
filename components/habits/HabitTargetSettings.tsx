'use client';

import type { JSX } from 'react';
import { useState } from 'react';

import { sortWeekdays } from '@/components/habits/habit-target-format';
import { HabitTargetRow } from '@/components/habits/HabitTargetRow';
import { HABIT_PREVIEWS } from '@/components/habits/habit-catalog';
import { Card } from '@/components/ui/Card';
import { HABIT_TARGET_COPY } from '@/lib/copy/habit-targets';
import { HABIT_KEYS } from '@/types/habit';
import type { UseHabitTargetsResult } from '@/hooks/useHabitTargets';
import type { HabitKey } from '@/types/habit';
import type { HabitTargetWeekday } from '@/types/habit-target';

interface HabitTargetSettingsProps {
  targets: UseHabitTargetsResult;
}

type WeekdayDrafts = Record<HabitKey, HabitTargetWeekday[]>;

function emptyDrafts(): WeekdayDrafts {
  const drafts = {} as WeekdayDrafts;
  for (const key of HABIT_KEYS) {
    drafts[key] = [];
  }
  return drafts;
}

/**
 * Seeds the editable draft from the server truth: a configured habit starts from
 * its saved weekdays and an unconfigured habit starts empty. Called when the
 * target list identity changes, so a refresh can never silently keep editing a
 * stale version.
 */
function draftsFromTargets(nextTargets: UseHabitTargetsResult['targets']): WeekdayDrafts {
  const next = emptyDrafts();
  for (const habitKey of HABIT_KEYS) {
    const target = nextTargets[habitKey];
    next[habitKey] = target !== null ? sortWeekdays(target.weekdays) : [];
  }
  return next;
}

/**
 * `Mis días objetivo` section: configure each fixed habit without changing how
 * today is recorded.
 *
 * The section owns only the unsaved draft; the canonical load/save/deactivate
 * behaviour lives in {@link import('@/hooks/useHabitTargets').useHabitTargets}.
 * Copy states that a saved change is effective today in Córdoba and that earlier
 * days are preserved, so the versioned intention is never presented as a rewrite
 * of history.
 *
 * @param props The target hook result, including mutators and error state.
 * @returns The configuration card for the four catalog habits.
 * @example
 * <HabitTargetSettings targets={targets} />
 */
export function HabitTargetSettings({ targets }: HabitTargetSettingsProps): JSX.Element {
  const [drafts, setDrafts] = useState<WeekdayDrafts>(() => draftsFromTargets(targets.targets));
  const [syncedTargets, setSyncedTargets] = useState(targets.targets);

  if (targets.targets !== syncedTargets) {
    setSyncedTargets(targets.targets);
    setDrafts(draftsFromTargets(targets.targets));
  }

  const showRows = !targets.loading || targets.configuredCount > 0;

  return (
    <Card level="panel" className="min-w-0 space-y-4 p-5">
      <div className="min-w-0 space-y-1">
        <h2 className="font-serif text-xl font-semibold text-ink">{HABIT_TARGET_COPY.sectionTitle}</h2>
        <p className="text-xs leading-relaxed text-ink-muted">{HABIT_TARGET_COPY.sectionIntro}</p>
      </div>

      {targets.loading && targets.configuredCount === 0 ? (
        <p
          data-testid="habit-target-settings-loading"
          aria-live="polite"
          className="text-sm leading-relaxed text-ink-muted"
        >
          {HABIT_TARGET_COPY.loading}
        </p>
      ) : null}

      {targets.error !== null ? (
        <div
          data-testid="habit-target-settings-error"
          className="space-y-2 rounded-xl bg-danger-muted p-3 text-sm text-danger"
        >
          <p aria-live="polite">{targets.error.message}</p>
          <button
            type="button"
            onClick={targets.reload}
            className="min-h-11 rounded-lg border border-danger px-4 text-sm font-semibold text-danger transition hover:bg-danger/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
          >
            {HABIT_TARGET_COPY.retry}
          </button>
        </div>
      ) : null}

      {targets.configuredCount === 0 && targets.error === null && !targets.loading ? (
        <p className="text-sm leading-relaxed text-ink-muted">{HABIT_TARGET_COPY.notConfigured}</p>
      ) : null}

      {showRows ? (
        <ul className="min-w-0 divide-y divide-line">
          {HABIT_PREVIEWS.map((habit) => (
            <HabitTargetRow
              key={habit.id}
              habit={habit}
              target={targets.targets[habit.id]}
              selected={drafts[habit.id]}
              expectedToday={targets.expectedTodayByKey[habit.id]}
              saving={targets.saving}
              onSelect={(weekdays) =>
                setDrafts((current) => ({ ...current, [habit.id]: weekdays }))
              }
              onSave={() => {
                void targets.save(habit.id, drafts[habit.id]);
              }}
              onDeactivate={() => {
                void targets.deactivate(habit.id);
              }}
            />
          ))}
        </ul>
      ) : null}

      {targets.saving ? (
        <p aria-live="polite" className="text-xs text-ink-muted">
          {HABIT_TARGET_COPY.saving}
        </p>
      ) : null}

      <div className="space-y-1 border-t border-line pt-3">
        <p className="text-xs leading-relaxed text-ink-muted">{HABIT_TARGET_COPY.effectiveFromToday}</p>
        <p className="text-xs leading-relaxed text-ink-muted">{HABIT_TARGET_COPY.pastPreserved}</p>
      </div>
    </Card>
  );
}
