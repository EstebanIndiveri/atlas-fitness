'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ExerciseSessionMemoryClientError,
  deleteWorkoutExerciseNote,
  fetchExerciseSessionContext,
  putWorkoutExerciseNote,
} from '@/lib/api/exercise-session-memory';
import { SESSION_COPY } from '@/lib/copy/session';
import {
  MAX_EXERCISE_NOTE_CODE_POINTS,
  validateExerciseNote,
} from '@/lib/session/exercise-session-memory';
import type {
  ExerciseNoteRejection,
  ExerciseSessionContext,
} from '@/types/exercise-session-memory';

/**
 * Exercise-session memory UI state (Atlas v0.11, Workstream D).
 *
 * Keyed by `workoutId`/`exerciseId`. A load never blocks set logging: the hook is
 * standalone and every failure is surfaced as a typed, local error. Writes are
 * explicit (never debounce/autosave) and use the compare-and-swap token from the
 * currently loaded note, so a stale tab refetches server truth instead of
 * silently overwriting it. A response for a previous exercise can never
 * overwrite the current exercise because each effect run owns a monotonic
 * request sequence and loaded data is only exposed for the active key.
 */

export type ExerciseSessionMemoryErrorKind =
  | 'load'
  | 'save'
  | 'delete'
  | 'conflict'
  | 'validation';

/** Typed, local failure for the exercise-memory UI. */
export interface ExerciseSessionMemoryError {
  kind: ExerciseSessionMemoryErrorKind;
  message: string;
}

export interface UseExerciseSessionMemoryInput {
  workoutId: number;
  exerciseId: number;
}

export interface UseExerciseSessionMemoryResult {
  /** Bounded context for the active exercise; `null` while loading/error. */
  context: ExerciseSessionContext | null;
  loading: boolean;
  saving: boolean;
  error: ExerciseSessionMemoryError | null;
  /** Refetches the active exercise context, e.g. from a retry button. */
  reload: () => void;
  /** Explicit create/update; returns `true` on persisted success. */
  saveNote: (note: string) => Promise<boolean>;
  /** Explicit delete with the exact loaded token; returns `true` on success. */
  deleteNote: () => Promise<boolean>;
}

interface LoadedContext {
  key: string;
  context: ExerciseSessionContext;
}

interface KeyedError {
  key: string;
  error: ExerciseSessionMemoryError;
}

function contextKey(workoutId: number, exerciseId: number): string {
  return `${workoutId}:${exerciseId}`;
}

function mapLoadError(caught: unknown): ExerciseSessionMemoryError {
  if (caught instanceof ExerciseSessionMemoryClientError && caught.kind === 'unauthorized') {
    return { kind: 'load', message: SESSION_COPY.notesSessionExpired };
  }
  return { kind: 'load', message: SESSION_COPY.notesLoadError };
}

function mapWriteError(
  caught: unknown,
  kind: 'save' | 'delete',
): ExerciseSessionMemoryError {
  if (caught instanceof ExerciseSessionMemoryClientError) {
    if (caught.kind === 'conflict') {
      return { kind: 'conflict', message: SESSION_COPY.notesConflict };
    }
    if (caught.kind === 'unauthorized') {
      return { kind, message: SESSION_COPY.notesSessionExpired };
    }
    if (caught.kind === 'validation') {
      return { kind: 'validation', message: caught.message };
    }
  }
  return {
    kind,
    message: kind === 'save' ? SESSION_COPY.notesSaveError : SESSION_COPY.notesDeleteError,
  };
}

function validationMessage(reason: ExerciseNoteRejection): string {
  if (reason === 'too_long') {
    return SESSION_COPY.notesTooLong(MAX_EXERCISE_NOTE_CODE_POINTS);
  }
  return SESSION_COPY.notesEmptyError;
}

/**
 * Loads and explicitly mutates the current exercise note plus the previous
 * completed encounter for the guided player.
 *
 * @param input - Active workout and exercise ids.
 * @returns Context, loading/saving/error state and explicit mutators.
 * @example
 * const memory = useExerciseSessionMemory({ workoutId: 8, exerciseId: 10 });
 * await memory.saveNote('Subir a 42.5 kg');
 */
export function useExerciseSessionMemory({
  workoutId,
  exerciseId,
}: UseExerciseSessionMemoryInput): UseExerciseSessionMemoryResult {
  const [loaded, setLoaded] = useState<LoadedContext | null>(null);
  const [loadError, setLoadError] = useState<KeyedError | null>(null);
  const [writeError, setWriteError] = useState<KeyedError | null>(null);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [requestId, setRequestId] = useState(0);

  const key = contextKey(workoutId, exerciseId);
  const keyRef = useRef(key);
  const requestSeq = useRef(0);
  const mountedRef = useRef(true);
  const contextRef = useRef<ExerciseSessionContext | null>(null);

  const context = loaded !== null && loaded.key === key ? loaded.context : null;
  const loading = settledKey !== key;
  const error =
    loadError?.key === key ? loadError.error : writeError?.key === key ? writeError.error : null;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  useEffect(() => {
    const requestKey = contextKey(workoutId, exerciseId);
    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const next = await fetchExerciseSessionContext(workoutId, exerciseId);
        if (!cancelled && seq === requestSeq.current) {
          setLoaded({ key: requestKey, context: next });
          setLoadError(null);
        }
      } catch (caught) {
        if (!cancelled && seq === requestSeq.current) {
          setLoadError({ key: requestKey, error: mapLoadError(caught) });
        }
      } finally {
        if (!cancelled && seq === requestSeq.current) {
          setSettledKey(requestKey);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [workoutId, exerciseId, requestId]);

  const refreshServerTruth = useCallback(
    async (targetExerciseId: number): Promise<void> => {
      const requestKey = contextKey(workoutId, targetExerciseId);
      try {
        const next = await fetchExerciseSessionContext(workoutId, targetExerciseId);
        if (mountedRef.current && keyRef.current === requestKey) {
          setLoaded({ key: requestKey, context: next });
        }
      } catch {
        // Keep the visible data; the error notice already owns the screen.
      }
    },
    [workoutId],
  );

  const reload = useCallback(() => {
    setLoadError(null);
    setWriteError(null);
    setSettledKey(null);
    setRequestId((value) => value + 1);
  }, []);

  const saveNote = useCallback(
    async (raw: string): Promise<boolean> => {
      const validated = validateExerciseNote(raw);
      if (!validated.ok) {
        setWriteError({
          key: contextKey(workoutId, exerciseId),
          error: { kind: 'validation', message: validationMessage(validated.reason) },
        });
        return false;
      }

      const currentNote = contextRef.current?.currentNote ?? null;
      setSaving(true);
      setWriteError(null);

      try {
        await putWorkoutExerciseNote({
          workoutId,
          exerciseId,
          note: validated.note,
          expectedNoteId: currentNote?.id ?? null,
          expectedVersion: currentNote?.version ?? null,
        });
        if (mountedRef.current) {
          await refreshServerTruth(exerciseId);
        }
        return true;
      } catch (caught) {
        if (mountedRef.current) {
          const mapped = mapWriteError(caught, 'save');
          setWriteError({ key: contextKey(workoutId, exerciseId), error: mapped });
          if (mapped.kind === 'conflict') {
            await refreshServerTruth(exerciseId);
          }
        }
        return false;
      } finally {
        if (mountedRef.current) {
          setSaving(false);
        }
      }
    },
    [workoutId, exerciseId, refreshServerTruth],
  );

  const deleteNote = useCallback(async (): Promise<boolean> => {
    const currentNote = contextRef.current?.currentNote;
    if (!currentNote) {
      return true;
    }

    setSaving(true);
    setWriteError(null);

    try {
      await deleteWorkoutExerciseNote({
        workoutId,
        exerciseId,
        expectedNoteId: currentNote.id,
        expectedVersion: currentNote.version,
      });
      if (mountedRef.current) {
        await refreshServerTruth(exerciseId);
      }
      return true;
    } catch (caught) {
      if (mountedRef.current) {
        const mapped = mapWriteError(caught, 'delete');
        setWriteError({ key: contextKey(workoutId, exerciseId), error: mapped });
        if (mapped.kind === 'conflict') {
          await refreshServerTruth(exerciseId);
        }
      }
      return false;
    } finally {
      if (mountedRef.current) {
        setSaving(false);
      }
    }
  }, [workoutId, exerciseId, refreshServerTruth]);

  return { context, loading, saving, error, reload, saveNote, deleteNote };
}
