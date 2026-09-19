'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ROUTINE_COPY } from '@/lib/copy/routines';
import {
  createRoutine,
  fetchExercises,
  fetchRoutine,
  patchExerciseMedia,
  RoutineClientError,
  updateRoutine,
} from '@/lib/routines/client';
import {
  addExercise,
  applyCatalogOwnership,
  draftFromRoutine,
  emptyDraft,
  isRoutineReadOnly,
  moveExercise,
  removeExercise,
  toWritePayload,
  updateDraftExercise,
  updateDraftMeta,
  validateDraft,
  type DraftExercise,
  type RoutineDraft,
} from '@/lib/routines/form-state';
import type { ExerciseCatalogItem } from '@/types/exercise';
import type { RoutineSummary } from '@/types/routine';

function asClientError(error: unknown): RoutineClientError {
  if (error instanceof RoutineClientError) {
    return error;
  }
  return new RoutineClientError('generic', ROUTINE_COPY.errorGeneric, 0);
}

function nextClientId(): string {
  return `ex-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

type MediaSnapshot = { imageUrl: string | null; videoUrl: string | null };

async function persistCustomMedia(
  exercises: readonly DraftExercise[],
  baseline: ReadonlyMap<number, MediaSnapshot>,
): Promise<void> {
  for (const exercise of exercises) {
    if (exercise.isSystem) continue;
    const imageUrl = exercise.imageUrl?.trim() ? exercise.imageUrl.trim() : null;
    const videoUrl = exercise.videoUrl?.trim() ? exercise.videoUrl.trim() : null;
    const previous = baseline.get(exercise.exerciseId);
    if (previous && previous.imageUrl === imageUrl && previous.videoUrl === videoUrl) {
      continue;
    }
    await patchExerciseMedia(exercise.exerciseId, { imageUrl, videoUrl });
  }
}

export function useRoutineEditor(mode: 'create' | 'edit', routineId?: number) {
  const [draft, setDraft] = useState<RoutineDraft>(emptyDraft);
  const [catalog, setCatalog] = useState<ExerciseCatalogItem[]>([]);
  const [baselineMedia, setBaselineMedia] = useState<Map<number, MediaSnapshot>>(new Map());
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null);
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setNotFound(false);
      try {
        const [catalogItems, routine] = await Promise.all([
          fetchExercises(),
          mode === 'edit' && routineId ? fetchRoutine(routineId) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setCatalog(catalogItems);
        setBaselineMedia(
          new Map(catalogItems.map((item) => [item.id, { imageUrl: item.imageUrl, videoUrl: item.videoUrl }])),
        );
        if (mode === 'edit') {
          if (!routine) {
            setNotFound(true);
            return;
          }
          setDraft(applyCatalogOwnership(draftFromRoutine(routine), catalogItems));
          setReadOnly(isRoutineReadOnly(routine));
        } else {
          setDraft(emptyDraft());
          setReadOnly(false);
        }
        setError(null);
      } catch (cause) {
        if (cancelled) return;
        const mapped = asClientError(cause);
        if (mapped.kind === 'not_found') {
          setNotFound(true);
          setError(null);
        } else {
          setError(mapped.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [mode, routineId]);

  const validation = useMemo(() => {
    if (!showErrors) {
      return { ok: true, items: {} as ReturnType<typeof validateDraft>['items'] };
    }
    return validateDraft(draft);
  }, [draft, showErrors]);

  const onMetaChange = useCallback((patch: Parameters<typeof updateDraftMeta>[1]) => {
    setDraft((current) => updateDraftMeta(current, patch));
  }, []);

  const onAddExercise = useCallback(() => {
    if (selectedExerciseId === null) return;
    const item = catalog.find((exercise) => exercise.id === selectedExerciseId);
    if (!item) return;
    setDraft((current) => {
      const result = addExercise(current, item, nextClientId());
      setDuplicateMessage(result.duplicate ? ROUTINE_COPY.duplicateExercise : null);
      return result.draft;
    });
  }, [catalog, selectedExerciseId]);

  const onUpdateExercise = useCallback((clientId: string, patch: Parameters<typeof updateDraftExercise>[2]) => {
    setDraft((current) => updateDraftExercise(current, clientId, patch));
  }, []);

  const onMoveExercise = useCallback((clientId: string, direction: 'up' | 'down') => {
    setDraft((current) => moveExercise(current, clientId, direction));
  }, []);

  const onRemoveExercise = useCallback((clientId: string) => {
    setDraft((current) => removeExercise(current, clientId));
  }, []);

  const save = useCallback(async (): Promise<RoutineSummary | null> => {
    setShowErrors(true);
    if (!validateDraft(draft).ok || readOnly) {
      return null;
    }
    setBusy(true);
    try {
      await persistCustomMedia(draft.exercises, baselineMedia);
      const payload = toWritePayload(draft);
      const saved =
        mode === 'create' || !routineId
          ? await createRoutine(payload)
          : await updateRoutine(routineId, payload);
      setError(null);
      return saved;
    } catch (cause) {
      const mapped = asClientError(cause);
      if (mapped.kind === 'forbidden') setReadOnly(true);
      if (mapped.kind === 'not_found' && mode === 'edit') setNotFound(true);
      setError(mapped.message);
      return null;
    } finally {
      setBusy(false);
    }
  }, [baselineMedia, draft, mode, readOnly, routineId]);

  return {
    draft,
    catalog,
    selectedExerciseId,
    setSelectedExerciseId,
    duplicateMessage,
    validation,
    loading,
    busy,
    error,
    notFound,
    readOnly,
    onMetaChange,
    onAddExercise,
    onUpdateExercise,
    onMoveExercise,
    onRemoveExercise,
    save,
  };
}
