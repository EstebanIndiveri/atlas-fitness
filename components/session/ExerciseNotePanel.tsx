'use client';

import { useState } from 'react';

import { SESSION_COPY } from '@/lib/copy/session';
import {
  MAX_EXERCISE_NOTE_CODE_POINTS,
  countExerciseNoteCodePoints,
} from '@/lib/session/exercise-session-memory';
import { cn } from '@/lib/ui/cn';
import type { ExerciseSessionMemoryError } from '@/hooks/useExerciseSessionMemory';
import type { ExerciseSessionContext } from '@/types/exercise-session-memory';

export interface ExerciseNotePanelProps {
  exerciseId: number;
  exerciseName: string;
  readOnly: boolean;
  context: ExerciseSessionContext | null;
  loading: boolean;
  saving: boolean;
  error: ExerciseSessionMemoryError | null;
  onSave: (note: string) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onRetry: () => void;
}

/**
 * Persisted exercise note editor for the guided player.
 *
 * The component owns only the unsaved draft. The draft is re-seeded from the
 * server truth whenever the saved note identity (id + version) changes, which
 * happens after a successful save, a delete or a conflict refetch — so a failed
 * save keeps the user's text. The 280 bound is enforced with the shared
 * Unicode code-point helper; native `maxLength` is intentionally absent.
 *
 * @param props Context plus explicit save/delete/retry callbacks.
 * @returns The note editor with visible persisted status.
 */
export function ExerciseNotePanel({
  exerciseId,
  exerciseName,
  readOnly,
  context,
  loading,
  saving,
  error,
  onSave,
  onDelete,
  onRetry,
}: ExerciseNotePanelProps) {
  const savedNote = context?.currentNote ?? null;
  const sourceKey = `${exerciseId}:${savedNote?.id ?? 'none'}:${savedNote?.version ?? 0}:${
    savedNote?.note ?? ''
  }`;
  const [draft, setDraft] = useState(() => savedNote?.note ?? '');
  const [syncedKey, setSyncedKey] = useState(sourceKey);

  if (sourceKey !== syncedKey) {
    setSyncedKey(sourceKey);
    setDraft(savedNote?.note ?? '');
  }

  const inputId = `guided-exercise-note-${exerciseId}`;
  const helperId = `${inputId}-helper`;
  const codePoints = countExerciseNoteCodePoints(draft);
  const overLimit = codePoints > MAX_EXERCISE_NOTE_CODE_POINTS;
  const awaitingContext = loading && context === null;
  const dirty = savedNote ? draft !== savedNote.note : draft.trim().length > 0;
  const canSave =
    !saving && !readOnly && !awaitingContext && codePoints > 0 && !overLimit;
  const showDelete = savedNote !== null;

  const status = readOnly
    ? SESSION_COPY.notesReadOnly
    : awaitingContext
      ? SESSION_COPY.notesLoading
      : saving
        ? SESSION_COPY.notesSaving
        : savedNote && !dirty
          ? SESSION_COPY.notesSaved
          : dirty
            ? SESSION_COPY.notesDirty
            : SESSION_COPY.notesNone;

  return (
    <div
      data-testid="exercise-note-panel"
      className="mx-4 mt-4 min-w-0 rounded-2xl bg-canvas p-3"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
        {SESSION_COPY.notesTitle}
      </p>
      <label htmlFor={inputId} className="mt-2 block text-sm font-medium text-ink">
        {SESSION_COPY.notesLabel(exerciseName)}
      </label>
      <textarea
        id={inputId}
        className="mt-2 min-h-24 w-full resize-none rounded-xl bg-surface px-3 py-3 text-base leading-6 text-ink outline-none ring-1 ring-line placeholder:text-ink-muted focus:ring-2 focus:ring-brand disabled:opacity-60"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={SESSION_COPY.notesPlaceholder}
        readOnly={readOnly || awaitingContext}
        disabled={readOnly}
        aria-describedby={helperId}
        data-testid="exercise-note-input"
      />
      <div
        id={helperId}
        className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted"
      >
        <span>{SESSION_COPY.notesHelper}</span>
        <span
          data-testid="note-counter"
          className={cn('tabular-nums', overLimit && 'font-semibold text-danger')}
        >
          {SESSION_COPY.notesCounter(codePoints, MAX_EXERCISE_NOTE_CODE_POINTS)}
        </span>
      </div>

      {overLimit ? (
        <p role="alert" className="mt-2 text-xs font-medium text-danger">
          {SESSION_COPY.notesTooLong(MAX_EXERCISE_NOTE_CODE_POINTS)}
        </p>
      ) : null}

      {error ? (
        <div
          data-testid="note-error"
          role="alert"
          className="mt-3 space-y-2 rounded-xl bg-danger-muted p-3 text-sm text-danger"
        >
          <p>{error.message}</p>
          {error.kind === 'load' ? (
            <button
              type="button"
              onClick={onRetry}
              className="min-h-11 rounded-lg border border-danger px-4 text-sm font-semibold text-danger"
            >
              {SESSION_COPY.lastTimeRetry}
            </button>
          ) : null}
        </div>
      ) : null}

      <p
        data-testid="note-status"
        role="status"
        aria-live="polite"
        aria-busy={awaitingContext}
        className="mt-2 text-xs text-ink-muted"
      >
        {status}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void onSave(draft)}
          disabled={!canSave}
          className="min-h-11 flex-1 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground disabled:opacity-50"
        >
          {SESSION_COPY.notesSave}
        </button>
        {showDelete ? (
          <button
            type="button"
            onClick={() => void onDelete()}
            disabled={saving || readOnly}
            className="min-h-11 flex-1 rounded-xl bg-surface px-4 text-sm font-semibold text-danger ring-1 ring-line disabled:opacity-50"
          >
            {SESSION_COPY.notesDelete}
          </button>
        ) : null}
      </div>
    </div>
  );
}
