'use client';

import { useState } from 'react';

import { ExerciseMedia } from '@/components/exercises/ExerciseMedia';
import { AtlasIcon } from '@/components/ui/AtlasIcon';
import type { AtlasIconName } from '@/components/ui/atlas-icons';
import { Card } from '@/components/ui/Card';
import { MetricValue } from '@/components/ui/MetricValue';
import { ExerciseNotePanel } from '@/components/session/ExerciseNotePanel';
import { ExerciseProgressionPanel } from '@/components/session/ExerciseProgressionPanel';
import { LastCompletedPanel } from '@/components/session/LastCompletedPanel';
import { SetCheckList } from '@/components/session/SetCheckList';
import { SessionCompleteSetBar } from '@/components/session/SessionCompleteSetBar';
import { useExerciseSessionMemory } from '@/hooks/useExerciseSessionMemory';
import { PROGRESSION_COPY } from '@/lib/copy/exercise-progression';
import { SESSION_COPY } from '@/lib/copy/session';
import { resolveProgressionSupport } from '@/lib/session/progression-cohort';
import { cn } from '@/lib/ui/cn';
import { metric } from '@/types/metric';
import type { RoutineExerciseItem } from '@/types/routine';
import type { SessionSemanticsControls } from '@/lib/session/semantics-draft';

type GuidedExerciseCardProps = {
  workoutId: number;
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
  readOnly?: boolean;
  nextExerciseName?: string | null;
  semantics?: SessionSemanticsControls;
  canSubmitSet?: boolean;
};

type CompletedSet = {
  setIndex: number;
  weightKg: string;
  reps: number;
  semanticCaptureVersion?: number | null;
  loadMode?: string | null;
  amountBasis?: string | null;
  side?: string | null;
  setPurpose?: string | null;
  repCountBasis?: string | null;
};

type SecondaryPanel = 'technique' | 'replace' | 'notes' | 'last' | 'progression';

function ActionChip({
  children,
  icon,
  ariaLabel,
  active,
  onClick,
}: {
  children: string;
  icon: AtlasIconName;
  ariaLabel: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition',
        active ? 'bg-brand text-brand-foreground shadow-card' : 'bg-canvas text-ink-muted',
      )}
      aria-label={ariaLabel}
      aria-pressed={active}
      onClick={onClick}
    >
      <AtlasIcon name={icon} size="sm" />
      <span>{children}</span>
    </button>
  );
}

/**
 * Active exercise card for the guided-session player.
 *
 * @param props Exercise metadata plus current-session set data and completion controls.
 * @returns A Figma-aligned exercise card with persisted note and previous-encounter panels.
 * @example
 * <GuidedExerciseCard workoutId={8} exercise={exercise} completedCount={1} weight="75" onWeightChange={() => {}} onCompleteSet={() => {}} busy={false} />
 */
export function GuidedExerciseCard({
  workoutId,
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
  readOnly = false,
  nextExerciseName,
  semantics,
  canSubmitSet,
}: GuidedExerciseCardProps) {
  const [panel, setPanel] = useState<SecondaryPanel | null>(null);
  const memory = useExerciseSessionMemory({ workoutId, exerciseId: exercise.exerciseId });
  const repsValue = Number.parseInt(reps, 10);
  // The comparable cohort comes only from the current *visible* declared
  // semantics; an unsupported selection yields a truthful non-comparable state.
  const progressionSupport = resolveProgressionSupport({
    loadMode: semantics?.draft.loadMode ?? '',
    amountBasis: semantics?.draft.amountBasis ?? '',
    side: semantics?.draft.side ?? '',
    setPurpose: semantics?.draft.setPurpose ?? '',
    reps: Number.isFinite(repsValue) ? repsValue : 0,
  });
  const safeCompletedCount = Math.min(completedCount, exercise.targetSets);
  const activeSet = Math.min(safeCompletedCount + 1, exercise.targetSets);
  const canCompleteSet = safeCompletedCount < exercise.targetSets;
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
              icon="technique"
              ariaLabel={SESSION_COPY.showTechnique}
              active={panel === 'technique'}
              onClick={() => togglePanel('technique')}
            >
              Técnica
            </ActionChip>
            <ActionChip
              icon="replace"
              ariaLabel={SESSION_COPY.showReplace}
              active={panel === 'replace'}
              onClick={() => togglePanel('replace')}
            >
              Reemplazar
            </ActionChip>
            <ActionChip
              icon="notes"
              ariaLabel={SESSION_COPY.showNotes}
              active={panel === 'notes'}
              onClick={() => togglePanel('notes')}
            >
              Notas
            </ActionChip>
            <ActionChip
              icon="history"
              ariaLabel={SESSION_COPY.showLastTime}
              active={panel === 'last'}
              onClick={() => togglePanel('last')}
            >
              {SESSION_COPY.lastTimeChip}
            </ActionChip>
            <ActionChip
              icon="progression"
              ariaLabel={PROGRESSION_COPY.showAria}
              active={panel === 'progression'}
              onClick={() => togglePanel('progression')}
            >
              {PROGRESSION_COPY.chip}
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
          <ExerciseNotePanel
            exerciseId={exercise.exerciseId}
            exerciseName={exercise.exerciseName}
            readOnly={readOnly}
            context={memory.context}
            loading={memory.loading}
            saving={memory.saving}
            error={memory.error}
            onSave={memory.saveNote}
            onDelete={memory.deleteNote}
            onRetry={memory.reload}
          />
        ) : null}
        {panel === 'last' ? (
          <LastCompletedPanel
            context={memory.context}
            loading={memory.loading}
            error={memory.error}
            onRetry={memory.reload}
          />
        ) : null}
        {panel === 'progression' ? (
          <ExerciseProgressionPanel
            exerciseId={exercise.exerciseId}
            support={progressionSupport}
          />
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
            semantics={semantics}
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
          canComplete={canSubmitSet}
          onCompleteSet={onCompleteSet}
        />
      ) : null}
    </>
  );
}
