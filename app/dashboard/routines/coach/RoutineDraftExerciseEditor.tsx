'use client';

import { useState } from 'react';

import { buttonClassName } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ExerciseMedia } from '@/components/exercises/ExerciseMedia';
import { Input } from '@/components/ui/Input';
import { UI_COPY } from '@/lib/copy/ui';
import type { RoutineDraft, RoutineDraftCatalogItem, RoutineDraftExercise } from '@/lib/ai/routine-draft';

const COPY = UI_COPY.training.coachRoutine;

type CandidateStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface RoutineDraftExerciseEditorProps {
  draft: RoutineDraft;
  busy: boolean;
  hasInvalidTargets: boolean;
  onDraftChange: (draft: RoutineDraft) => void;
  onLoadCandidates: () => Promise<RoutineDraftCatalogItem[]>;
}

export function RoutineDraftExerciseEditor({
  draft,
  busy,
  hasInvalidTargets,
  onDraftChange,
  onLoadCandidates,
}: RoutineDraftExerciseEditorProps) {
  const [editingExerciseId, setEditingExerciseId] = useState<number | null>(null);
  const [candidatePool, setCandidatePool] = useState<RoutineDraftCatalogItem[]>([]);
  const [candidateStatus, setCandidateStatus] = useState<CandidateStatus>('idle');
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const replacementCandidates = candidatePool.filter(
    (candidate) => !draft.exercises.some((exercise) => exercise.exerciseId === candidate.id),
  );

  function updateDraft(exercises: RoutineDraftExercise[]): void {
    onDraftChange({
      ...draft,
      reason: COPY.editedReason,
      exercises: exercises.map((exercise, sortOrder) => ({ ...exercise, sortOrder })),
    });
  }

  function updateTarget(exerciseId: number, field: 'targetSets' | 'targetReps', value: string): void {
    const target = value === '' ? 0 : Number(value);
    updateDraft(draft.exercises.map((exercise) => (
      exercise.exerciseId === exerciseId ? { ...exercise, [field]: target } : exercise
    )));
  }

  function removeExercise(exerciseId: number): void {
    updateDraft(draft.exercises.filter((exercise) => exercise.exerciseId !== exerciseId));
    if (editingExerciseId === exerciseId) setEditingExerciseId(null);
  }

  async function openReplacement(exerciseId: number): Promise<void> {
    setEditingExerciseId(exerciseId);
    setCandidateStatus('loading');
    setCandidateError(null);
    setSelectedCandidateId('');
    try {
      setCandidatePool(await onLoadCandidates());
      setCandidateStatus('ready');
    } catch (caught) {
      setCandidateError(caught instanceof Error ? caught.message : COPY.candidatesError);
      setCandidateStatus('error');
    }
  }

  function confirmReplacement(): void {
    const candidate = replacementCandidates.find((item) => String(item.id) === selectedCandidateId);
    const currentExercise = draft.exercises.find((exercise) => exercise.exerciseId === editingExerciseId);
    if (!candidate || !currentExercise) {
      setCandidateError(COPY.candidatesError);
      setCandidateStatus('error');
      return;
    }

    updateDraft(draft.exercises.map((exercise) => (
      exercise.exerciseId === currentExercise.exerciseId
        ? {
          exerciseId: candidate.id,
          exerciseName: candidate.name,
          muscleGroup: candidate.muscleGroup,
          instructions: candidate.instructions,
          imageUrl: candidate.imageUrl,
          videoUrl: candidate.videoUrl,
          ...(candidate.equipment ? { equipment: candidate.equipment } : {}),
          sortOrder: exercise.sortOrder,
          targetSets: exercise.targetSets,
          targetReps: exercise.targetReps,
        }
        : exercise
    )));
    setEditingExerciseId(null);
    setCandidateStatus('idle');
    setSelectedCandidateId('');
  }

  return (
    <Card className="space-y-3 rounded-xl">
      <h2 className="text-lg font-bold text-ink">{COPY.exerciseBreakdownTitle}</h2>
      {draft.exercises.length === 0 ? (
        <p role="status" className="rounded-lg bg-canvas p-3 text-sm text-ink-muted">
          {COPY.emptyProposal}
        </p>
      ) : (
        <ul className="space-y-3">
          {draft.exercises.map((exercise) => {
            const editing = editingExerciseId === exercise.exerciseId;
            return (
              <li key={exercise.exerciseId} className="space-y-3 rounded-xl bg-canvas p-3 ring-1 ring-line">
                <div className="space-y-2">
                  <div>
                    <p className="font-semibold text-ink">{exercise.exerciseName}</p>
                    <p className="text-sm text-ink-muted">{exercise.muscleGroup}</p>
                  </div>
                  <ExerciseMedia
                    name={exercise.exerciseName}
                    imageUrl={exercise.imageUrl ?? null}
                    videoUrl={exercise.videoUrl}
                    emptyLabel={COPY.imageMissing}
                    videoLabel={`Video de ${exercise.exerciseName}`}
                    imageTestId={`routine-proposal-image-${exercise.exerciseId}`}
                    videoTestId={`routine-proposal-video-${exercise.exerciseId}`}
                  />
                  <p className="text-sm leading-6 text-ink">
                    {exercise.instructions?.trim() || COPY.instructionsMissing}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    id={`proposal-sets-${exercise.exerciseId}`}
                    label={COPY.setsForExercise(exercise.exerciseName)}
                    type="number"
                    min={1}
                    step={1}
                    value={exercise.targetSets}
                    onChange={(event) => updateTarget(exercise.exerciseId, 'targetSets', event.target.value)}
                  />
                  <Input
                    id={`proposal-reps-${exercise.exerciseId}`}
                    label={COPY.repsForExercise(exercise.exerciseName)}
                    type="number"
                    min={1}
                    step={1}
                    value={exercise.targetReps}
                    onChange={(event) => updateTarget(exercise.exerciseId, 'targetReps', event.target.value)}
                  />
                </div>

                {editing ? (
                  <div className="space-y-2 rounded-lg bg-surface p-3">
                    {candidateStatus === 'loading' ? (
                      <p role="status" className="text-sm text-ink-muted">{COPY.replacementLoading}</p>
                    ) : null}
                    {candidateStatus === 'error' && candidateError ? (
                      <div className="space-y-2">
                        <p role="alert" className="text-sm text-danger">{candidateError}</p>
                        <button
                          type="button"
                          className={buttonClassName({ variant: 'secondary' })}
                          disabled={busy}
                          onClick={() => void openReplacement(exercise.exerciseId)}
                        >
                          {COPY.retryCandidates}
                        </button>
                      </div>
                    ) : null}
                    {candidateStatus === 'ready' && replacementCandidates.length === 0 ? (
                      <p role="status" className="text-sm text-ink-muted">{COPY.replacementEmpty}</p>
                    ) : null}
                    {candidateStatus === 'ready' && replacementCandidates.length > 0 ? (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-ink">
                          {COPY.replacementLabel(exercise.exerciseName)}
                          <select
                            className="mt-1 w-full rounded-md border border-line bg-surface px-4 py-2"
                            value={selectedCandidateId}
                            onChange={(event) => setSelectedCandidateId(event.target.value)}
                          >
                            <option value="">{COPY.chooseReplacement}</option>
                            {replacementCandidates.map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.name} · {candidate.muscleGroup}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          className={buttonClassName({ size: 'md' })}
                          disabled={busy || !selectedCandidateId}
                          onClick={confirmReplacement}
                        >
                          {COPY.confirmReplacement}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    className={buttonClassName({ variant: 'secondary' })}
                    disabled={busy}
                    onClick={() => void openReplacement(exercise.exerciseId)}
                  >
                    {COPY.changeExercise(exercise.exerciseName)}
                  </button>
                  <button
                    type="button"
                    className={buttonClassName({ variant: 'secondary' })}
                    disabled={busy}
                    onClick={() => removeExercise(exercise.exerciseId)}
                  >
                    {COPY.removeExercise(exercise.exerciseName)}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {hasInvalidTargets ? <p role="alert" className="text-sm text-danger">{COPY.invalidTargets}</p> : null}
    </Card>
  );
}
