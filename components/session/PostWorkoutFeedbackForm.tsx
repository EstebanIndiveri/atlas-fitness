'use client';

import {
  DiscomfortPicker,
  POST_WORKOUT_FEEDBACK_DISCOMFORT_MAX_ENTRIES,
} from '@/components/session/DiscomfortPicker';
import { ErrorState } from '@/components/ui/states';
import {
  POST_WORKOUT_SENSATIONS,
  SESSION_COPY,
} from '@/lib/copy/session';
import { cn } from '@/lib/ui/cn';
import type {
  DiscomfortEntry,
  WorkoutSensation,
} from '@/lib/services/post-workout-feedback';
import type { ReactElement } from 'react';

export const POST_WORKOUT_FEEDBACK_NOTE_MAX_LENGTH = 500;
export { POST_WORKOUT_FEEDBACK_DISCOMFORT_MAX_ENTRIES };

type PostWorkoutFeedbackFormProps = {
  effort: number | null;
  onEffort: (value: number) => void;
  sensation: WorkoutSensation | null;
  onSensation: (value: WorkoutSensation) => void;
  onLegacyMood?: (value: number) => void;
  discomfort: DiscomfortEntry[];
  onDiscomfortChange: (entries: DiscomfortEntry[]) => void;
  note: string;
  onNoteChange: (value: string) => void;
  disabled?: boolean;
  error?: string | null;
};

const effortValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/**
 * Collects the explicit post-workout feedback required by the feedback API.
 *
 * @param props Controlled feedback fields and callbacks owned by the session page.
 * @returns Accessible controls for effort, sensation, optional discomfort, and note.
 * @example
 * <PostWorkoutFeedbackForm effort={7} onEffort={setEffort} sensation="good" onSensation={setSensation} />
 */
export function PostWorkoutFeedbackForm({
  effort,
  onEffort,
  sensation,
  onSensation,
  onLegacyMood,
  discomfort,
  onDiscomfortChange,
  note,
  onNoteChange,
  disabled = false,
  error = null,
}: PostWorkoutFeedbackFormProps): ReactElement {
  return (
    <div className="space-y-5">
      {error ? <ErrorState message={error} /> : null}
      <EffortSelector effort={effort} onEffort={onEffort} disabled={disabled} />
      <SensationSelector
        sensation={sensation}
        onSensation={onSensation}
        onLegacyMood={onLegacyMood}
        disabled={disabled}
      />
      <DiscomfortPicker
        discomfort={discomfort}
        onDiscomfortChange={onDiscomfortChange}
        disabled={disabled}
      />
      <NoteField note={note} onNoteChange={onNoteChange} disabled={disabled} />
    </div>
  );
}

function EffortSelector({
  effort,
  onEffort,
  disabled,
}: {
  effort: number | null;
  onEffort: (value: number) => void;
  disabled: boolean;
}): ReactElement {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink">{SESSION_COPY.effortLabel}</legend>
      <div className="grid grid-cols-5 gap-2" role="group" aria-label={SESSION_COPY.effortLabel}>
        {effortValues.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onEffort(value)}
            disabled={disabled}
            aria-pressed={effort === value}
            aria-label={SESSION_COPY.effortOptionLabel(value)}
            className={cn(
              'rounded-xl px-3 py-2 text-sm font-semibold ring-1 ring-line transition',
              effort === value ? 'bg-brand text-brand-foreground shadow-card' : 'bg-surface text-ink',
            )}
            data-testid={`close-effort-${value}`}
          >
            {value}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function SensationSelector({
  sensation,
  onSensation,
  onLegacyMood,
  disabled,
}: {
  sensation: WorkoutSensation | null;
  onSensation: (value: WorkoutSensation) => void;
  onLegacyMood?: (value: number) => void;
  disabled: boolean;
}): ReactElement {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink">{SESSION_COPY.sensationLabel}</legend>
      <div className="flex justify-between gap-2" role="group" aria-label={SESSION_COPY.sensationLabel}>
        {POST_WORKOUT_SENSATIONS.map(({ value, legacyMood, emoji, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              onSensation(value);
              onLegacyMood?.(legacyMood);
            }}
            disabled={disabled}
            aria-pressed={sensation === value}
            aria-label={label}
            className={cn(
              'rounded-xl p-2 text-3xl transition',
              sensation === value ? 'bg-brand-muted shadow-card' : 'opacity-50 hover:opacity-100',
            )}
            data-testid={`close-mood-${legacyMood}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function NoteField({
  note,
  onNoteChange,
  disabled,
}: {
  note: string;
  onNoteChange: (value: string) => void;
  disabled: boolean;
}): ReactElement {
  return (
    <label className="block text-sm font-medium text-ink">
      {SESSION_COPY.noteLabel}
      <textarea
        aria-label={SESSION_COPY.noteLabel}
        value={note}
        onChange={(event) => onNoteChange(event.target.value)}
        disabled={disabled}
        maxLength={POST_WORKOUT_FEEDBACK_NOTE_MAX_LENGTH}
        rows={3}
        className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink"
      />
      <span className="mt-1 block text-xs text-ink-muted">{SESSION_COPY.noteHelp}</span>
    </label>
  );
}
