'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { CheckInEnergy, CheckInMood } from '@/lib/api/checkin';
import * as coachPreview from '@/lib/api/coach-preview';
import type { CoachAdaptationResult } from '@/types/coach';

export type CoachAdaptStep = 'motivo' | 'comparacion' | 'confirmado';
export type CoachWorkoutStartStatus = 'idle' | 'pending' | 'conflict' | 'error' | 'started';

export type CoachCheckInContext = Readonly<{
  dailyCheckInId: number;
  mood: CheckInMood;
  energy: CheckInEnergy;
}>;

export interface UseCoachAdaptInput {
  routineId: number | null;
  checkInContext: CoachCheckInContext | null;
  trainingPlanId?: number | null;
}

export interface UseCoachAdaptResult {
  step: CoachAdaptStep;
  result: CoachAdaptationResult | null;
  error: string | null;
  previewing: boolean;
  starting: boolean;
  startStatus: CoachWorkoutStartStatus;
  previewWithContext: (freeText: string) => Promise<CoachAdaptationResult | null>;
  startWorkout: (applyAdaptation?: boolean) => Promise<void>;
  adjustAgain: () => void;
}

const COPY = {
  previewFallback: 'No se pudo cargar la adaptación de Coach Atlas.',
  startFallback: 'No se pudo iniciar el entrenamiento. Probá de nuevo en unos minutos.',
  startConflict: 'Ya hay un entrenamiento activo. Continuá esa sesión antes de iniciar otra.',
  missingRoutine: 'Necesitás un entrenamiento de hoy para adaptar.',
  missingCheckIn: 'Registrá tu ánimo y energía antes de preparar una vista previa.',
  missingPreview: 'Prepará una vista previa antes de iniciar el entrenamiento adaptado.',
  stalePreview: 'La rutina o el check-in cambió. Prepará una nueva vista previa antes de iniciar.',
} as const;

/**
 * Coordinates the Coach Atlas adaptation state machine and workout start flow.
 *
 * @param input Routine id and the current user-provided mood/energy snapshot, if complete.
 * @returns State and actions for motivo, comparación, and confirmado steps.
 * @example
 * const adapt = useCoachAdapt({ routineId: 12, checkInContext: { mood: 4, energy: 'high' } });
 */
export function useCoachAdapt({
  routineId,
  checkInContext,
  trainingPlanId = null,
}: UseCoachAdaptInput): UseCoachAdaptResult {
  const router = useRouter();
  const [step, setStep] = useState<CoachAdaptStep>('motivo');
  const [result, setResult] = useState<CoachAdaptationResult | null>(null);
  const [resultRoutineId, setResultRoutineId] = useState<number | null>(null);
  const [resultTrainingPlanId, setResultTrainingPlanId] = useState<number | null>(null);
  const [resultCheckInContextKey, setResultCheckInContextKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startStatus, setStartStatus] = useState<CoachWorkoutStartStatus>('idle');
  const startingRef = useRef(false);
  const routineContextRef = useRef({ routineId, trainingPlanId });
  const previewRequestRef = useRef(0);
  const invalidatedPreviewRef = useRef(false);
  const checkInEnergy = checkInContext?.energy;
  const checkInMood = checkInContext?.mood;
  const dailyCheckInId = checkInContext?.dailyCheckInId;
  const checkInContextKey =
    dailyCheckInId === undefined || checkInEnergy === undefined || checkInMood === undefined
      ? null
      : `${dailyCheckInId}:${checkInMood}:${checkInEnergy}`;
  const checkInContextKeyRef = useRef(checkInContextKey);
  const adaptationRef = useRef<{
    routineId: number;
    trainingPlanId: number | null;
    checkInContextKey: string;
    result: CoachAdaptationResult;
    freeText: string;
    checkInContext: CoachCheckInContext;
  } | null>(null);

  useEffect(() => {
    if (
      routineContextRef.current.routineId === routineId &&
      routineContextRef.current.trainingPlanId === trainingPlanId
    ) {
      return;
    }

    routineContextRef.current = { routineId, trainingPlanId };
    previewRequestRef.current += 1;
    invalidatedPreviewRef.current =
      invalidatedPreviewRef.current || adaptationRef.current !== null;
    adaptationRef.current = null;
    setStep('motivo');
    setResult(null);
    setResultRoutineId(null);
    setResultTrainingPlanId(null);
    setResultCheckInContextKey(null);
    setError(null);
    setPreviewing(false);
    setStartStatus('idle');
  }, [routineId, trainingPlanId]);

  useEffect(() => {
    if (checkInContextKeyRef.current === checkInContextKey) {
      return;
    }

    checkInContextKeyRef.current = checkInContextKey;
    previewRequestRef.current += 1;
    invalidatedPreviewRef.current =
      invalidatedPreviewRef.current || adaptationRef.current !== null;
    adaptationRef.current = null;
    setStep('motivo');
    setResult(null);
    setResultRoutineId(null);
    setResultTrainingPlanId(null);
    setResultCheckInContextKey(null);
    setError(null);
    setPreviewing(false);
    setStartStatus('idle');
  }, [checkInContextKey]);

  const previewWithContext = useCallback(
    async (freeText: string): Promise<CoachAdaptationResult | null> => {
      if (routineId === null) {
        setError(COPY.missingRoutine);
        return null;
      }
      if (checkInContext === null || checkInContextKey === null) {
        setError(COPY.missingCheckIn);
        setResult(null);
        setResultRoutineId(null);
        setResultTrainingPlanId(null);
        setResultCheckInContextKey(null);
        adaptationRef.current = null;
        setStep('motivo');
        setStartStatus('idle');
        return null;
      }
      const trimmed = freeText.trim();
      const requestCheckInContextKey = checkInContextKey;
      const requestCheckInContext = { ...checkInContext };
      const requestId = previewRequestRef.current + 1;
      previewRequestRef.current = requestId;
      setPreviewing(true);
      setError(null);
      setResult(null);
      setResultRoutineId(null);
      setResultTrainingPlanId(null);
      setResultCheckInContextKey(null);
      setStartStatus('idle');
      adaptationRef.current = null;
      try {
        const preview = await coachPreview.previewCoachAdaptation({
          routineId,
          ...(trainingPlanId === null ? {} : { trainingPlanId }),
          energy: checkInEnergy,
          mood: checkInMood,
          ...(trimmed ? { freeText: trimmed } : {}),
        });
        if (
          requestId !== previewRequestRef.current ||
          routineContextRef.current.routineId !== routineId ||
          routineContextRef.current.trainingPlanId !== trainingPlanId ||
          checkInContextKeyRef.current !== requestCheckInContextKey
        ) {
          return null;
        }
        setResult(preview);
        setResultRoutineId(routineId);
        setResultTrainingPlanId(trainingPlanId);
        setResultCheckInContextKey(requestCheckInContextKey);
        adaptationRef.current = {
          routineId,
          trainingPlanId,
          checkInContextKey: requestCheckInContextKey,
          result: preview,
          freeText: trimmed,
          checkInContext: requestCheckInContext,
        };
        invalidatedPreviewRef.current = false;
        setStep('comparacion');
        return preview;
      } catch (caught) {
        if (
          requestId !== previewRequestRef.current ||
          routineContextRef.current.routineId !== routineId ||
          routineContextRef.current.trainingPlanId !== trainingPlanId ||
          checkInContextKeyRef.current !== requestCheckInContextKey
        ) {
          return null;
        }
        setError(mapPreviewError(caught));
        setStep('motivo');
        return null;
      } finally {
        if (requestId === previewRequestRef.current) {
          setPreviewing(false);
        }
      }
    },
    [checkInContext, checkInEnergy, checkInMood, checkInContextKey, routineId, trainingPlanId],
  );

  const startWorkout = useCallback(async (applyAdaptation: boolean = true): Promise<void> => {
    if (startingRef.current) {
      return;
    }
    if (routineId === null) {
      setError(COPY.missingRoutine);
      setStartStatus('error');
      return;
    }
    const storedAdaptation = adaptationRef.current;
    const stalePreview = (invalidatedPreviewRef.current && storedAdaptation === null) ||
      (storedAdaptation !== null &&
        (storedAdaptation.routineId !== routineId ||
          storedAdaptation.trainingPlanId !== trainingPlanId ||
          storedAdaptation.checkInContextKey !== checkInContextKey));
    if (applyAdaptation && stalePreview) {
      setError(COPY.stalePreview);
      setStartStatus('error');
      return;
    }
    if (applyAdaptation && storedAdaptation === null) {
      setError(COPY.missingPreview);
      setStartStatus('error');
      return;
    }
    startingRef.current = true;
    setStarting(true);
    setStartStatus('pending');
    setError(null);
    try {
      const adaptation = applyAdaptation && storedAdaptation?.routineId === routineId
        ? storedAdaptation
        : null;
      const planContext = trainingPlanId === null ? {} : { trainingPlanId };
      const payload = adaptation
        ? {
            routineId,
            ...planContext,
            adaptation: {
              result: adaptation.result,
              ...(adaptation.freeText ? { freeText: adaptation.freeText } : {}),
              dailyCheckInId: adaptation.checkInContext.dailyCheckInId,
              checkInContext: {
                mood: adaptation.checkInContext.mood,
                energy: adaptation.checkInContext.energy,
              },
            },
          }
        : { routineId, ...planContext };
      const response = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body: unknown = await response.json();
      if (response.status === 409) {
        setError(readApiMessage(body) ?? COPY.startConflict);
        setStartStatus('conflict');
        return;
      }
      if (!response.ok) {
        setError(readApiMessage(body) ?? COPY.startFallback);
        setStartStatus('error');
        return;
      }
      if (response.status !== 201 || !isRecord(body) || !isPositiveInteger(body.id)) {
        throw new Error('Invalid workout start response');
      }
      setStep('confirmado');
      setStartStatus('started');
      router.push(`/dashboard/session/${body.id}`);
    } catch {
      setError(COPY.startFallback);
      setStartStatus('error');
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }, [checkInContextKey, routineId, router, trainingPlanId]);

  const adjustAgain = useCallback((): void => {
    setStep('motivo');
    setResult(null);
    setResultRoutineId(null);
    setResultTrainingPlanId(null);
    setResultCheckInContextKey(null);
    setError(null);
    setStartStatus('idle');
    adaptationRef.current = null;
    invalidatedPreviewRef.current = false;
  }, []);

  const previewMatchesCurrentInputs =
    resultRoutineId === routineId &&
    resultTrainingPlanId === trainingPlanId &&
    resultCheckInContextKey === checkInContextKey &&
    checkInContextKey !== null;

  return {
    step: result !== null && !previewMatchesCurrentInputs ? 'motivo' : step,
    result: previewMatchesCurrentInputs ? result : null,
    error,
    previewing,
    starting,
    startStatus,
    previewWithContext,
    startWorkout,
    adjustAgain,
  };
}

function readApiMessage(value: unknown): string | null {
  if (
    !isRecord(value) ||
    typeof value.message !== 'string' ||
    value.message.trim().length === 0
  ) {
    return null;
  }
  return value.message;
}

function mapPreviewError(caught: unknown): string {
  if (caught instanceof coachPreview.CoachPreviewClientError) {
    return caught.message || COPY.previewFallback;
  }
  return COPY.previewFallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
