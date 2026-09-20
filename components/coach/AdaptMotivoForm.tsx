'use client';

import { FormEvent, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/states';

type Preset = {
  label: string;
  icon: string;
  freeText: string;
};

export interface AdaptMotivoFormProps {
  loading: boolean;
  error: string | null;
  onSubmit: (freeText: string) => void;
}

const PRESETS: readonly Preset[] = [
  { label: 'Tengo 30 min', icon: '⏱️', freeText: 'Tengo 30 minutos' },
  { label: 'Estoy cansado', icon: '🪫', freeText: 'Estoy cansado' },
  { label: 'Sin máquinas', icon: '🏠', freeText: 'Sin máquinas disponibles' },
  { label: 'Quiero algo más liviano', icon: '🌿', freeText: 'Quiero algo más liviano' },
] as const;

/**
 * Collects the user's adaptation reason without inventing energy or mood data.
 *
 * @param props Loading state, error message, and submit callback.
 * @returns Preset chips, free-text input, and check-in based action.
 * @example
 * <AdaptMotivoForm loading={false} error={null} onSubmit={submit} />
 */
export function AdaptMotivoForm({ loading, error, onSubmit }: AdaptMotivoFormProps) {
  const [freeText, setFreeText] = useState('');

  const submitText = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const trimmed = freeText.trim();
    if (!trimmed || loading) {
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <Card className="space-y-4 rounded-xl">
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-ink">¿Qué necesitás ajustar?</h2>
        <p className="text-sm leading-6 text-ink-muted">
          Atlas usa tu check-in real de hoy o el contexto que escribas. No inventamos energía ni ánimo.
        </p>
      </div>

      <Button variant="secondary" size="lg" disabled={loading} onClick={() => onSubmit('')}>
        Usar mi check-in de hoy
      </Button>

      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Motivos rápidos">
        {PRESETS.map((preset) => (
          <Button
            key={preset.label}
            variant="secondary"
            size="md"
            className="min-h-14 justify-start gap-2 rounded-xl px-3 text-left text-xs sm:text-sm"
            disabled={loading}
            onClick={() => onSubmit(preset.freeText)}
          >
            <span aria-hidden="true">{preset.icon}</span>
            <span>{preset.label}</span>
          </Button>
        ))}
      </div>

      <form className="space-y-3" onSubmit={submitText}>
        <label htmlFor="coach-adapt-free-text" className="text-sm font-semibold text-ink">
          Contale a Atlas qué cambió
        </label>
        <textarea
          id="coach-adapt-free-text"
          value={freeText}
          onChange={(event) => setFreeText(event.target.value)}
          maxLength={180}
          rows={3}
          disabled={loading}
          className="w-full resize-none rounded-xl bg-canvas p-3 text-sm text-ink ring-1 ring-line placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand disabled:cursor-not-allowed disabled:opacity-60"
          placeholder="Ej: tengo poco tiempo, no dormí bien o entreno en casa."
        />
        <Button type="submit" size="lg" disabled={loading || freeText.trim().length === 0}>
          Previsualizar ajuste
        </Button>
      </form>

      {loading ? <LoadingState label="Atlas está preparando una propuesta…" compact /> : null}
      {error ? <ErrorState title="Necesitamos datos reales" message={error} compact={false} /> : null}
    </Card>
  );
}
