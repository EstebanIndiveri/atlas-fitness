'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import * as coachPreview from '@/lib/api/coach-preview';
import type { CoachAdaptationResult } from '@/types/coach';

export type CoachAdaptStep = 'motivo' | 'comparacion' | 'confirmado';

export interface UseCoachAdaptInput {
  routineId: number;
}

export interface UseCoachAdaptResult {
  step: CoachAdaptStep;
  result: CoachAdaptationResult | null;
  error: string | null;
  previewing: boolean;
  starting: boolean;
  previewWithContext: (freeText: string) => Promise<void>;
  startWorkout: (applyAdaptation?: boolean) => Promise<void>;
  adjustAgain: () => void;
}

const COPY = {
  previewFallback: 'No se pudo cargar la adaptación de Coach Atlas.',
  startFallback: 'No se pudo iniciar el entrenamiento. Probá de nuevo en unos minutos.',
} as const;

/**
 * Coordinates the Coach Atlas adaptation state machine and workout start flow.
 *
 * @param input Routine id to preview and start.
 * @returns State and actions for motivo, comparación, and confirmado steps.
 * @example
 * const adapt = useCoachAdapt({ routineId: 12 });
 */
export function useCoachAdapt({ routineId }: UseCoachAdaptInput): UseCoachAdaptResult {
  const router = useRouter();
  const [step, setStep] = useState<CoachAdaptStep>('motivo');
  const [result, setResult] = useState<CoachAdaptationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const adaptationRef = useRef<{ result: CoachAdaptationResult; freeText: string } | null>(null);

  const previewWithContext = useCallback(
    async (freeText: string): Promise<void> => {
      const trimmed = freeText.trim();
      setPreviewing(true);
      setError(null);
      setResult(null);
      try {
        const preview = await coachPreview.previewCoachAdaptation({
          routineId,
          ...(trimmed ? { freeText: trimmed } : {}),
        });
        setResult(preview);
        adaptationRef.current = { result: preview, freeText: trimmed };
        setStep('comparacion');
      } catch (caught) {
        setError(mapPreviewError(caught));
        setStep('motivo');
      } finally {
        setPreviewing(false);
      }
    },
    [routineId],
  );

  const startWorkout = useCallback(async (applyAdaptation: boolean = true): Promise<void> => {
    if (startingRef.current) {
      return;
    }
    startingRef.current = true;
    setStarting(true);
    setError(null);
    try {
      const adaptation = applyAdaptation ? adaptationRef.current : null;
      const payload = adaptation
        ? {
            routineId,
            adaptation: {
              result: adaptation.result,
              ...(adaptation.freeText ? { freeText: adaptation.freeText } : {}),
            },
          }
        : { routineId };
      const response = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body: unknown = await response.json();
      if (response.status === 409) {
        const activeId = await fetchActiveWorkoutId();
        if (activeId !== null) {
          setStep('confirmado');
          router.push(activeId.href);
          return;
        }
      }
      if (!response.ok || !isRecord(body) || !isPositiveInteger(body.id)) {
        throw new Error('Invalid workout start response');
      }
      setStep('confirmado');
      router.push(`/dashboard/session/${body.id}`);
    } catch {
      setError(COPY.startFallback);
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }, [routineId, router]);

  const adjustAgain = useCallback((): void => {
    setStep('motivo');
    setResult(null);
    setError(null);
    adaptationRef.current = null;
  }, []);

  return { step, result, error, previewing, starting, previewWithContext, startWorkout, adjustAgain };
}

async function fetchActiveWorkoutId(): Promise<{ href: string } | null> {
  const response = await fetch('/api/workouts/active');
  if (!response.ok) {
    return null;
  }
  const body: unknown = await response.json();
  if (!isRecord(body) || !isPositiveInteger(body.id)) {
    return null;
  }
  const href = isPositiveInteger(body.routineId)
    ? `/dashboard/session/${body.id}`
    : `/dashboard/workout/${body.id}`;
  return { href };
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
