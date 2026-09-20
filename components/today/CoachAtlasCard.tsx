'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/states';
import * as coachPreview from '@/lib/api/coach-preview';
import { cn } from '@/lib/ui/cn';
import type { CoachAdaptationResult, CoachRoutineSummary } from '@/types/coach';

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
  eyebrow: '¿Cambió algo para hoy?',
  noRoutine: 'Necesitás un entrenamiento de hoy para adaptar.',
  inputLabel: 'Preguntarle algo a Atlas',
  inputPlaceholder: 'Preguntarle algo a Atlas',
  submitAria: 'Enviar pregunta a Atlas',
  loading: 'Atlas está ajustando la rutina…',
  provenance: 'Sugerencia de Atlas',
  original: 'Original',
  adapted: 'Adaptado',
  defaultError: 'No se pudo cargar la adaptación de Coach Atlas.',
} as const;

const PRESETS: readonly Preset[] = [
  { label: 'Tengo 30 min', icon: '⏱️', freeText: 'Tengo 30 minutos' },
  { label: 'Estoy cansado', icon: '🪫', freeText: 'Estoy cansado' },
  { label: 'Sin máquinas', icon: '🏠', freeText: 'Sin máquinas disponibles' },
  { label: 'Quiero algo más liviano', icon: '🌿', freeText: 'Quiero algo más liviano' },
] as const;

/**
 * Renders Coach Atlas quick-adaptation controls for today's workout routine.
 *
 * @param props.routineId Today's workout routine id, or null when there is nothing honest to adapt.
 * @param props.onResult Optional callback invoked with the preview returned by the typed Coach client.
 * @returns A mobile-first Coach Atlas adaptation card.
 * @example
 * <CoachAtlasCard routineId={today.kind === 'workout' ? today.routineId : null} />
 */
export function CoachAtlasCard({ routineId, onResult }: CoachAtlasCardProps) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [result, setResult] = useState<CoachAdaptationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [freeText, setFreeText] = useState('');
  const canAdapt = routineId !== null;
  const loading = loadingKey !== null;

  const requestPreview = async (text: string, key: string): Promise<void> => {
    if (!canAdapt) {
      return;
    }

    setLoadingKey(key);
    setError(null);
    setResult(null);
    try {
      const preview = await coachPreview.previewCoachAdaptation({ routineId, freeText: text });
      setResult(preview);
      onResult?.(preview);
    } catch (caught) {
      setError(mapPreviewError(caught));
    } finally {
      setLoadingKey(null);
    }
  };

  const submitFreeText = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const trimmed = freeText.trim();
    if (!trimmed || !canAdapt || loading) {
      return;
    }
    void requestPreview(trimmed, 'free-text');
  };

  return (
    <Card className="rounded-xl" data-testid="coach-atlas-card" aria-busy={loading}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">✦ Coach Atlas</h2>
        <p className="text-right text-xs text-ink-muted">{COPY.eyebrow}</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Adaptaciones rápidas de Atlas">
        {PRESETS.map((preset) => {
          const presetLoading = loadingKey === preset.label;
          const disabled = !canAdapt || loading;
          return (
            <Button
              key={preset.label}
              variant="secondary"
              size="md"
              className={cn(
                'min-h-14 justify-start gap-2 rounded-xl px-3 text-left text-xs sm:text-sm',
                presetLoading && 'ring-2 ring-brand',
              )}
              disabled={disabled}
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
            disabled={!canAdapt || loading}
            maxLength={180}
            className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            className="ml-2 rounded-md px-2 py-1 text-lg text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canAdapt || loading || freeText.trim().length === 0}
            aria-label={COPY.submitAria}
          >
            →
          </button>
        </div>
      </form>

      {loading ? <LoadingState label={COPY.loading} compact /> : null}
      {error ? <div className="mt-4"><ErrorState message={error} /></div> : null}
      {result ? <CoachResult result={result} /> : null}
    </Card>
  );
}

function CoachResult({ result }: { result: CoachAdaptationResult }) {
  return (
    <section className="mt-4 rounded-xl border border-line bg-canvas p-3" aria-label="Resultado de adaptación de Coach Atlas">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <SummaryBlock title={COPY.original} summary={result.original} />
        <SummaryBlock title={COPY.adapted} summary={result.adapted} />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink">{result.reason}</p>
      <p className="mt-2 text-xs text-ink-muted">{COPY.provenance}</p>
    </section>
  );
}

function SummaryBlock({ title, summary }: { title: string; summary: CoachRoutineSummary }) {
  return (
    <div className="rounded-lg bg-surface p-3">
      <p className="text-xs font-medium text-ink-muted">{title}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{formatSummary(summary)}</p>
    </div>
  );
}

function formatSummary(summary: CoachRoutineSummary): string {
  return `${summary.exerciseCount} ejercicios · ${summary.setCount} series · ${summary.estMinutes} min`;
}

function mapPreviewError(caught: unknown): string {
  if (caught instanceof coachPreview.CoachPreviewClientError) {
    return caught.message || COPY.defaultError;
  }
  return COPY.defaultError;
}
