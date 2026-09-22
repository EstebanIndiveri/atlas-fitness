'use client';

import { useState } from 'react';

import { ExerciseMedia } from '@/components/exercises/ExerciseMedia';
import { Card } from '@/components/ui/Card';
import { MetricValue } from '@/components/ui/MetricValue';
import { SetCheckList } from '@/components/session/SetCheckList';
import { SessionCompleteSetBar } from '@/components/session/SessionCompleteSetBar';
import { SESSION_COPY } from '@/lib/copy/session';
import { cn } from '@/lib/ui/cn';
import { metric } from '@/types/metric';
import type { RoutineExerciseItem } from '@/types/routine';

type GuidedExerciseCardProps = {
  exercise: RoutineExerciseItem;
  completedCount: number;
  completedSets?: readonly CompletedSet[];
  weight: string;
  onWeightChange: (value: string) => void;
  reps: string;
  onRepsChange: (value: string) => void;
  onCompleteSet: () => void;
  onAddSet?: () => void;
  onReplace?: () => void;
  onHold?: () => void;
  busy: boolean;
  resting?: boolean;
  nextExerciseName?: string | null;
};

type CompletedSet = {
  setIndex: number;
  weightKg: string;
  reps: number;
};

type SecondaryPanel = 'technique' | 'replace' | 'notes';

function ActionChip({
  children,
  ariaLabel,
  active,
  onClick,
}: {
  children: string;
  ariaLabel: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-lg px-3 py-2 text-xs font-medium transition',
        active ? 'bg-brand text-brand-foreground shadow-card' : 'bg-canvas text-ink-muted',
      )}
      aria-label={ariaLabel}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/**
 * Active exercise card for the guided-session player.
 *
 * @param props Exercise metadata plus current-session set data and completion controls.
 * @returns A Figma-aligned exercise card without inventing unavailable prior-session data.
 * @example
 * <GuidedExerciseCard exercise={exercise} completedCount={1} weight="75" onWeightChange={() => {}} onCompleteSet={() => {}} busy={false} />
 */
export function GuidedExerciseCard({
  exercise,
  completedCount,
  completedSets = [],
  weight,
  onWeightChange,
  reps,
  onRepsChange,
  onCompleteSet,
  onAddSet,
  onReplace,
  onHold,
  busy,
  resting = false,
  nextExerciseName,
}: GuidedExerciseCardProps) {
  const [panel, setPanel] = useState<SecondaryPanel | null>(null);
  const [noteText, setNoteText] = useState('');
  const safeCompletedCount = Math.min(completedCount, exercise.targetSets);
  const activeSet = Math.min(safeCompletedCount + 1, exercise.targetSets);
  const canCompleteSet = safeCompletedCount < exercise.targetSets;
  const noteInputId = `guided-exercise-note-${exercise.id}`;
  const togglePanel = (nextPanel: SecondaryPanel): void => {
    setPanel((currentPanel) => (currentPanel === nextPanel ? null : nextPanel));
  };

  return (
    <>
      <Card className="mb-4 overflow-hidden rounded-3xl p-0" data-testid="guided-exercise-card">
        <div className="bg-surface px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-brand-muted px-3 py-1 text-[11px] font-semibold text-brand">
              {exercise.muscleGroup}
            </span>
            <span className="text-xs font-medium text-ink-muted">
              <MetricValue
                metric={metric(SESSION_COPY.activeSetProgress(activeSet, exercise.targetSets), 'atlas_computed')}
                label="Serie actual"
              />
            </span>
          </div>
          <h2 className="mt-3 font-serif text-4xl font-semibold leading-none tracking-[-0.06em] text-brand" data-testid="guided-exercise-name">
            {exercise.exerciseName}
          </h2>
          <p className="mt-2 text-sm text-ink-muted">{exercise.exerciseName}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ActionChip
              ariaLabel={SESSION_COPY.showTechnique}
              active={panel === 'technique'}
              onClick={() => togglePanel('technique')}
            >
              ◎ Técnica ▸
            </ActionChip>
            <ActionChip
              ariaLabel={SESSION_COPY.showReplace}
              active={panel === 'replace'}
              onClick={() => togglePanel('replace')}
            >
              ⇄ Reemplazar
            </ActionChip>
            <ActionChip
              ariaLabel={SESSION_COPY.showNotes}
              active={panel === 'notes'}
              onClick={() => togglePanel('notes')}
            >
              ≣ Notas
            </ActionChip>
          </div>
        </div>
        {panel === 'technique' ? (
          <div className="px-4 pt-4">
            <ExerciseMedia
              name={exercise.exerciseName}
              imageUrl={exercise.imageUrl}
              videoUrl={exercise.videoUrl}
              emptyLabel={SESSION_COPY.noImage}
              videoLabel={SESSION_COPY.seeVideo}
              imageTestId="guided-exercise-image"
              videoTestId="guided-exercise-video"
            />
            {exercise.instructions ? (
              <p className="mt-3 text-sm leading-6 text-ink">{exercise.instructions}</p>
            ) : null}
          </div>
        ) : null}
        {panel === 'notes' ? (
          <div className="mx-4 mt-4 rounded-2xl bg-canvas p-3">
            <label
              htmlFor={noteInputId}
              className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted"
            >
              Nota de la sesión para {exercise.exerciseName}
            </label>
            <textarea
              id={noteInputId}
              className="mt-2 min-h-24 w-full resize-none rounded-xl bg-surface px-3 py-3 text-base leading-6 text-ink outline-none ring-1 ring-line placeholder:text-ink-muted focus:ring-2 focus:ring-brand"
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              maxLength={280}
              placeholder={SESSION_COPY.notesEmpty}
              aria-describedby={`${noteInputId}-helper`}
            />
            <div id={`${noteInputId}-helper`} className="mt-2 flex items-center justify-between gap-3 text-xs text-ink-muted">
              <span>Nota local de esta sesión.</span>
              <span className="tabular-nums">{noteText.length}/280</span>
            </div>
          </div>
        ) : null}
        {panel === 'replace' ? (
          <div className="mx-4 mt-4 rounded-2xl bg-canvas p-3">
            <p className="text-sm text-ink-muted">{SESSION_COPY.replaceHelper}</p>
            <div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
              <button
                type="button"
                className="min-h-11 rounded-xl bg-surface px-3 py-2 text-sm font-semibold text-ink ring-1 ring-line"
                onClick={onReplace}
                disabled={busy || !onReplace}
                aria-label={SESSION_COPY.skipExerciseAria}
              >
                {SESSION_COPY.replaceSkip}
              </button>
              <button
                type="button"
                className="min-h-11 rounded-xl bg-surface px-3 py-2 text-sm font-semibold text-ink ring-1 ring-line"
                onClick={onHold}
                disabled={busy || !onHold}
                aria-label={SESSION_COPY.holdExerciseAria}
              >
                {SESSION_COPY.replaceHold}
              </button>
            </div>
          </div>
        ) : null}
        <div className="mt-4 px-4 pb-4">
          <SetCheckList
            targetSets={exercise.targetSets}
            targetReps={exercise.targetReps}
            completedCount={completedCount}
            completedSets={completedSets}
            weight={weight}
            onWeightChange={onWeightChange}
            reps={reps}
            onRepsChange={onRepsChange}
            onCompleteSet={onCompleteSet}
            onAddSet={onAddSet}
            busy={busy}
            resting={resting}
            nextExerciseName={nextExerciseName}
          />
        </div>
      </Card>
      {canCompleteSet && !resting ? (
        <SessionCompleteSetBar
          activeSet={activeSet}
          weight={weight}
          reps={reps}
          busy={busy}
          nextExerciseName={nextExerciseName}
          onCompleteSet={onCompleteSet}
        />
      ) : null}
    </>
  );
}
