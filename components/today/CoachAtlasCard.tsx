'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';

import { CoachResult } from '@/components/today/CoachAtlasCardResult';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useCoachAdapt } from '@/hooks/useCoachAdapt';
import type { CoachCheckInContext } from '@/hooks/useCoachAdapt';
import { cn } from '@/lib/ui/cn';
import type { CoachAdaptationResult } from '@/types/coach';

export type TodayAvailability = 'loading' | 'error' | 'empty' | 'ready';
export type CheckInAvailability = 'loading' | 'saving' | 'error' | 'missing' | 'ready';

type CoachAtlasCardProps = {
  routineId: number | null;
  todayAvailability: TodayAvailability;
  todayError: string | null;
  checkInAvailability: CheckInAvailability;
  checkInError: string | null;
  checkInContext: CoachCheckInContext | null;
  onResult?: (result: CoachAdaptationResult) => void;
};

type Preset = {
  label: string;
  icon: string;
  freeText: string;
};

const COPY = {
  eyebrow: 'Rutina + datos que registraste',
  insight: 'La propuesta combina la rutina de hoy, tu check-in de ánimo y energía, y el ajuste que elegís o escribís.',
  quickAdjustments: 'Ajustes rápidos para tu sesión:',
  previewOnly: 'Vista previa: tu rutina guardada no cambia hasta iniciar la sesión.',
  noRoutine: 'Necesitás un entrenamiento de hoy para adaptar.',
  todayLoading: 'Cargando el entrenamiento de hoy…',
  checkInRequired: 'Registrá tu ánimo y energía para preparar una vista previa.',
  checkInLoading: 'Cargando tu check-in de hoy…',
  checkInSaving: 'Guardando tu check-in…',
  inputLabel: 'Preguntarle algo a Atlas',
  inputPlaceholder: 'Preguntarle algo a Atlas',
  submitAria: 'Enviar pregunta a Atlas',
  loading: 'Atlas está ajustando la rutina…',
  starting: 'Iniciando entrenamiento…',
  opening: 'Abriendo sesión…',
  start: 'Empezar entrenamiento adaptado',
} as const;

const PRESETS: readonly Preset[] = [
  { label: 'Tengo 30 min', icon: '⏱️', freeText: 'Tengo 30 minutos' },
  { label: 'Estoy cansado', icon: '🪫', freeText: 'Estoy cansado' },
  { label: 'Sin poleas', icon: '✦', freeText: 'Sin poleas disponibles' },
] as const;

/**
 * Renders a data-honest Coach Atlas preview and starts the adapted workout only
 * after the user confirms the session start.
 *
 * @param props Today's routine and check-in availability plus an optional preview callback.
 * @returns The Today Coach Atlas card.
 * @example
 * <CoachAtlasCard routineId={12} todayAvailability="ready" todayError={null}
 *   checkInAvailability="ready" checkInError={null} />
 */
export function CoachAtlasCard({
  routineId,
  todayAvailability,
  todayError,
  checkInAvailability,
  checkInError,
  checkInContext,
  onResult,
}: CoachAtlasCardProps) {
  const todayReady = todayAvailability === 'ready' && routineId !== null;
  const checkInReady = checkInAvailability === 'ready' && checkInContext !== null;
  const adapt = useCoachAdapt({ routineId, checkInContext: todayReady && checkInReady ? checkInContext : null });
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [freeText, setFreeText] = useState('');
  const started = adapt.startStatus === 'started';
  const busy = adapt.previewing || adapt.starting || started;
  const canAdapt = todayReady && checkInReady;

  const requestPreview = async (text: string, key: string): Promise<void> => {
    if (!canAdapt || busy) {
      return;
    }

    setLoadingKey(key);
    try {
      const preview = await adapt.previewWithContext(text);
      if (preview) {
        onResult?.(preview);
      }
    } finally {
      setLoadingKey(null);
    }
  };

  const submitFreeText = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const trimmed = freeText.trim();
    if (!trimmed || !canAdapt || busy) {
      return;
    }
    void requestPreview(trimmed, 'free-text');
  };

  return (
    <Card className="rounded-[1.75rem] p-5" data-testid="coach-atlas-card" aria-busy={busy}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">◎ Coach Atlas</h2>
        <p className="text-right text-xs text-ink-muted">{COPY.eyebrow}</p>
      </div>

      <p className="mt-4 text-sm leading-6 text-ink">{COPY.insight}</p>
      <p className="mt-5 text-sm font-semibold text-ink">{COPY.quickAdjustments}</p>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Adaptaciones rápidas de Atlas">
        {PRESETS.map((preset) => {
          const presetLoading = loadingKey === preset.label;
          return (
            <Button
              key={preset.label}
              variant="secondary"
              size="md"
              className={cn(
                'min-h-11 justify-start gap-2 rounded-full px-4 text-left text-xs sm:text-sm',
                presetLoading && 'ring-2 ring-brand',
              )}
              disabled={!canAdapt || busy}
              aria-busy={presetLoading}
              onClick={() => void requestPreview(preset.freeText, preset.label)}
            >
              <span aria-hidden="true">{presetLoading ? '↻' : preset.icon}</span>
              <span>{presetLoading ? `Adaptando ${preset.label}` : preset.label}</span>
            </Button>
          );
        })}
      </div>

      {todayAvailability === 'loading' ? <LoadingState label={COPY.todayLoading} compact /> : null}
      {todayAvailability === 'error' ? (
        <div className="mt-3"><ErrorState message={todayError ?? 'No se pudo cargar el plan de hoy.'} /></div>
      ) : null}
      {todayAvailability === 'empty' ? (
        <p className="mt-3 text-xs text-ink-muted">{COPY.noRoutine}</p>
      ) : null}
      {todayAvailability === 'ready' && routineId === null ? (
        <p className="mt-3 text-xs text-ink-muted">{COPY.noRoutine}</p>
      ) : null}
      {todayReady && checkInAvailability === 'loading' ? (
        <LoadingState label={COPY.checkInLoading} compact />
      ) : null}
      {todayReady && checkInAvailability === 'saving' ? (
        <LoadingState label={COPY.checkInSaving} compact />
      ) : null}
      {todayReady && checkInAvailability === 'error' ? (
        <div className="mt-3"><ErrorState message={checkInError ?? 'No se pudo cargar el check-in de hoy.'} /></div>
      ) : null}
      {todayReady && (
        checkInAvailability === 'missing' ||
        (checkInAvailability === 'ready' && checkInContext === null)
      ) ? (
        <p className="mt-3 text-xs text-ink-muted">{COPY.checkInRequired}</p>
      ) : null}

      <form onSubmit={submitFreeText} className="mt-4">
        <label className="sr-only" htmlFor="coach-atlas-free-text">
          {COPY.inputLabel}
        </label>
        <div className="flex min-h-12 items-center rounded-xl bg-canvas px-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-brand">
          <input
            id="coach-atlas-free-text"
            value={freeText}
            onChange={(event) => setFreeText(event.target.value)}
            placeholder={COPY.inputPlaceholder}
            disabled={!canAdapt || busy}
            maxLength={180}
            className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            className="ml-2 rounded-md px-2 py-1 text-lg text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canAdapt || busy || freeText.trim().length === 0}
            aria-label={COPY.submitAria}
          >
            →
          </button>
        </div>
      </form>

      {adapt.previewing ? <LoadingState label={COPY.loading} compact /> : null}
      {adapt.startStatus === 'pending' ? <LoadingState label={COPY.starting} compact /> : null}
      {started ? <LoadingState label={COPY.opening} compact /> : null}
      {adapt.error ? <div className="mt-4"><ErrorState message={adapt.error} /></div> : null}
      {adapt.result ? (
        <div className="mt-4 space-y-3">
          <CoachResult result={adapt.result} />
          <p className="text-xs leading-5 text-ink-muted">{COPY.previewOnly}</p>
          <Button
            size="lg"
            className="min-h-12 rounded-xl"
            disabled={busy}
            aria-busy={adapt.startStatus === 'pending' || started}
            onClick={() => void adapt.startWorkout(true)}
          >
            {adapt.starting ? COPY.starting : started ? COPY.opening : COPY.start}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
