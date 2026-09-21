'use client';

import { useState } from 'react';

import {
  DiscomfortPicker,
  POST_WORKOUT_FEEDBACK_DISCOMFORT_MAX_ENTRIES,
} from '@/components/session/DiscomfortPicker';
import { ErrorState } from '@/components/ui/states';
import {
  POST_WORKOUT_DISCOMFORT_TOGGLE,
  POST_WORKOUT_RPE_OPTIONS,
  POST_WORKOUT_SENSATIONS,
  SESSION_COPY,
} from '@/lib/copy/session';
import { cn } from '@/lib/ui/cn';
import type {
  DiscomfortEntry,
  WorkoutSensation,
} from '@/lib/services/post-workout-feedback';
import type { ReactElement } from 'react';

export { POST_WORKOUT_FEEDBACK_DISCOMFORT_MAX_ENTRIES };

type PostWorkoutFeedbackFormProps = {
  effort: number | null;
  onEffort: (value: number) => void;
  sensation: WorkoutSensation | null;
  onSensation: (value: WorkoutSensation) => void;
  onLegacyMood?: (value: number) => void;
  discomfort: DiscomfortEntry[];
  onDiscomfortChange: (entries: DiscomfortEntry[]) => void;
  disabled?: boolean;
  error?: string | null;
};

/**
 * Collects the explicit post-workout feedback required by the feedback API.
 *
 * @param props Controlled feedback fields and callbacks owned by the session page.
 * @returns Accessible controls for effort, sensation, and optional discomfort.
 * @example
 * <PostWorkoutFeedbackForm effort={9} onEffort={setEffort} sensation="good" onSensation={setSensation} />
 */
export function PostWorkoutFeedbackForm({
  effort,
  onEffort,
  sensation,
  onSensation,
  onLegacyMood,
  discomfort,
  onDiscomfortChange,
  disabled = false,
  error = null,
}: PostWorkoutFeedbackFormProps): ReactElement {
  return (
    <div className="space-y-5">
      {error ? <ErrorState message={error} /> : null}
      <FeedbackIntro />
      <SensationSelector
        sensation={sensation}
        onSensation={onSensation}
        onLegacyMood={onLegacyMood}
        disabled={disabled}
      />
      <EffortSelector effort={effort} onEffort={onEffort} disabled={disabled} />
      <DiscomfortSection
        discomfort={discomfort}
        onDiscomfortChange={onDiscomfortChange}
        disabled={disabled}
      />
    </div>
  );
}

function FeedbackIntro(): ReactElement {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-bold tracking-[-0.02em] text-ink">
        {SESSION_COPY.feedbackTitle}
      </h2>
      <p className="text-sm leading-6 text-ink-muted">{SESSION_COPY.feedbackHelper}</p>
    </div>
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
      <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {SESSION_COPY.sensationLabel}
      </legend>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={SESSION_COPY.sensationLabel}>
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
              'flex items-center gap-2 rounded-2xl px-3 py-3 text-left ring-1 ring-line transition',
              sensation === value
                ? 'bg-brand text-brand-foreground shadow-card ring-brand'
                : 'bg-surface text-ink hover:bg-brand-muted/50',
            )}
            data-testid={`close-mood-${value}`}
          >
            <span className="text-2xl" aria-hidden="true">{emoji}</span>
            <span className="text-sm font-semibold">{label}</span>
          </button>
        ))}
      </div>
    </fieldset>
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
      <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {SESSION_COPY.effortLabel}
      </legend>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={SESSION_COPY.effortLabel}>
        {POST_WORKOUT_RPE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onEffort(option.effort)}
            disabled={disabled}
            aria-pressed={effort === option.effort}
            aria-label={SESSION_COPY.effortOptionLabel(option.label, option.rpeCaption)}
            className={cn(
              'rounded-2xl px-3 py-3 text-left ring-1 ring-line transition',
              effort === option.effort
                ? 'bg-brand text-brand-foreground shadow-card ring-brand'
                : 'bg-surface text-ink hover:bg-brand-muted/50',
            )}
            data-testid={`close-effort-${option.id}`}
          >
            <span className="block text-sm font-semibold">{option.label}</span>
            <span className="mt-1 block text-xs opacity-80">{option.rpeCaption}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function DiscomfortSection({
  discomfort,
  onDiscomfortChange,
  disabled,
}: {
  discomfort: DiscomfortEntry[];
  onDiscomfortChange: (entries: DiscomfortEntry[]) => void;
  disabled: boolean;
}): ReactElement {
  const [registering, setRegistering] = useState(discomfort.length > 0);
  const isClearSelected = !registering && discomfort.length === 0;

  const selectClear = (): void => {
    setRegistering(false);
    onDiscomfortChange([]);
  };

  return (
    <div className="rounded-2xl bg-canvas p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {SESSION_COPY.discomfortTitle}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label={SESSION_COPY.discomfortTitle}>
        <ToggleButton
          label={POST_WORKOUT_DISCOMFORT_TOGGLE.noneLabel}
          selected={isClearSelected}
          disabled={disabled}
          onClick={selectClear}
        />
        <ToggleButton
          label={POST_WORKOUT_DISCOMFORT_TOGGLE.registerLabel}
          selected={registering}
          disabled={disabled}
          onClick={() => setRegistering(true)}
        />
      </div>
      {!registering && discomfort.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">{SESSION_COPY.discomfortEmpty}</p>
      ) : null}
      {registering ? (
        <div className="mt-3">
          <DiscomfortPicker
            discomfort={discomfort}
            onDiscomfortChange={onDiscomfortChange}
            disabled={disabled}
          />
        </div>
      ) : null}
    </div>
  );
}

function ToggleButton({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'rounded-xl px-3 py-2 text-sm font-semibold ring-1 ring-line transition',
        selected ? 'bg-brand text-brand-foreground shadow-card ring-brand' : 'bg-surface text-ink',
      )}
    >
      {label}
    </button>
  );
}
