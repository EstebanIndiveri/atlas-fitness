'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';

import { CoachResult } from '@/components/today/CoachAtlasCardResult';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useCoachAdapt } from '@/hooks/useCoachAdapt';
import { cn } from '@/lib/ui/cn';
import type { CoachAdaptationResult } from '@/types/coach';

type CoachAtlasCardProps = {
  routineId: number | null;
  onResult?: (result: CoachAdaptationResult) => void;
};

type Preset = {
  label: string;
  icon: string;
  freeText: string;
};

const COPY = {
  eyebrow: 'Rutina + datos que registraste',
  insight: 'La propuesta compara la rutina de hoy con tu check-in (si lo completaste) y el ajuste que elegís o escribís.',
  quickAdjustments: 'Ajustes rápidos para tu sesión:',
  previewOnly: 'Vista previa: tu rutina guardada no cambia hasta iniciar la sesión.',
  noRoutine: 'Necesitás un entrenamiento de hoy para adaptar.',
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
 * @param props Today's routine id and an optional callback for a successful preview.
 * @returns The Today Coach Atlas card.
 * @example
 * <CoachAtlasCard routineId={today.kind === 'workout' ? today.routineId : null} />
 */
export function CoachAtlasCard({ routineId, onResult }: CoachAtlasCardProps) {
  const adapt = useCoachAdapt({ routineId });
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [freeText, setFreeText] = useState('');
  const started = adapt.startStatus === 'started';
  const busy = adapt.previewing || adapt.starting || started;
  const canAdapt = routineId !== null;

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

      {!canAdapt ? <p className="mt-3 text-xs text-ink-muted">{COPY.noRoutine}</p> : null}

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
