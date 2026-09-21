'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import {
  DISCOMFORT_AREA_OPTIONS,
  DISCOMFORT_INTENSITY_OPTIONS,
  SESSION_COPY,
} from '@/lib/copy/session';
import type {
  DiscomfortArea,
  DiscomfortEntry,
  DiscomfortIntensity,
} from '@/lib/services/post-workout-feedback';
import type { ReactElement } from 'react';

export const POST_WORKOUT_FEEDBACK_DISCOMFORT_MAX_ENTRIES = 5;

type DiscomfortPickerProps = {
  discomfort: DiscomfortEntry[];
  onDiscomfortChange: (entries: DiscomfortEntry[]) => void;
  disabled: boolean;
};

/**
 * Lets users register up to five optional post-workout discomfort entries.
 *
 * @param props Controlled discomfort entries and disabled state.
 * @returns Accessible controls for area, intensity, add, and remove actions.
 * @example
 * <DiscomfortPicker discomfort={[]} onDiscomfortChange={setDiscomfort} disabled={false} />
 */
export function DiscomfortPicker({
  discomfort,
  onDiscomfortChange,
  disabled,
}: DiscomfortPickerProps): ReactElement {
  const [area, setArea] = useState<DiscomfortArea>('neck');
  const [intensity, setIntensity] = useState<DiscomfortIntensity>('mild');
  const reachedMax = discomfort.length >= POST_WORKOUT_FEEDBACK_DISCOMFORT_MAX_ENTRIES;

  const addEntry = (): void => {
    if (reachedMax) return;
    onDiscomfortChange([...discomfort, { area, intensity }]);
  };

  return (
    <div className="rounded-xl bg-canvas p-3">
      <p className="text-sm font-medium text-ink">{SESSION_COPY.discomfortTitle}</p>
      {discomfort.length === 0 ? (
        <p className="mt-1 text-sm text-ink-muted">{SESSION_COPY.discomfortEmpty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {discomfort.map((entry, index) => {
            const areaLabel = labelForArea(entry.area);
            const intensityLabel = labelForIntensity(entry.intensity);
            const label = `${areaLabel} · ${intensityLabel}`;
            return (
              <li
                key={`${entry.area}-${entry.intensity}-${index}`}
                className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2 text-sm text-ink"
              >
                <span>{label}</span>
                <button
                  type="button"
                  onClick={() => onDiscomfortChange(discomfort.filter((_, itemIndex) => itemIndex !== index))}
                  disabled={disabled}
                  className="font-medium text-brand"
                  aria-label={SESSION_COPY.discomfortRemove(label)}
                >
                  Quitar
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <AreaSelect value={area} onChange={setArea} disabled={disabled} />
        <IntensitySelect value={intensity} onChange={setIntensity} disabled={disabled} />
        <Button variant="secondary" onClick={addEntry} disabled={disabled || reachedMax} className="sm:self-end">
          {SESSION_COPY.discomfortAdd}
        </Button>
      </div>
      {reachedMax ? <p className="mt-2 text-xs text-ink-muted">{SESSION_COPY.discomfortMaxReached}</p> : null}
    </div>
  );
}

function AreaSelect({
  value,
  onChange,
  disabled,
}: {
  value: DiscomfortArea;
  onChange: (value: DiscomfortArea) => void;
  disabled: boolean;
}): ReactElement {
  return (
    <label className="text-xs font-medium text-ink">
      {SESSION_COPY.discomfortAreaLabel}
      <select
        value={value}
        onChange={(event) => onChange(parseDiscomfortArea(event.target.value))}
        disabled={disabled}
        className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
      >
        {DISCOMFORT_AREA_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function IntensitySelect({
  value,
  onChange,
  disabled,
}: {
  value: DiscomfortIntensity;
  onChange: (value: DiscomfortIntensity) => void;
  disabled: boolean;
}): ReactElement {
  return (
    <label className="text-xs font-medium text-ink">
      {SESSION_COPY.discomfortIntensityLabel}
      <select
        value={value}
        onChange={(event) => onChange(parseDiscomfortIntensity(event.target.value))}
        disabled={disabled}
        className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
      >
        {DISCOMFORT_INTENSITY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function parseDiscomfortArea(value: string): DiscomfortArea {
  return DISCOMFORT_AREA_OPTIONS.find((option) => option.value === value)?.value ?? 'neck';
}

function parseDiscomfortIntensity(value: string): DiscomfortIntensity {
  return DISCOMFORT_INTENSITY_OPTIONS.find((option) => option.value === value)?.value ?? 'mild';
}

function labelForArea(value: DiscomfortArea): string {
  return DISCOMFORT_AREA_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function labelForIntensity(value: DiscomfortIntensity): string {
  return DISCOMFORT_INTENSITY_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
