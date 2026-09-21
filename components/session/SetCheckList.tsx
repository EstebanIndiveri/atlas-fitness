'use client';

import { Button } from '@/components/ui/Button';
import { SESSION_COPY } from '@/lib/copy/session';

type SetCheckListProps = {
  targetSets: number;
  targetReps: number;
  completedCount: number;
  completedSets?: readonly CompletedSet[];
  weight: string;
  onWeightChange: (value: string) => void;
  reps: string;
  onRepsChange: (value: string) => void;
  onCompleteSet: () => void;
  busy: boolean;
  nextExerciseName?: string | null;
};

type CompletedSet = {
  setIndex: number;
  weightKg: string;
  reps: number;
};

function formatWeight(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function stepWeight(value: string, delta: number): string {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  const base = Number.isFinite(parsed) ? parsed : 0;
  return formatWeight(Math.max(0, base + delta));
}

function stepReps(value: string, delta: number, fallback: number): string {
  const parsed = Number.parseInt(value, 10);
  const base = Number.isFinite(parsed) ? parsed : fallback;
  return String(Math.max(1, base + delta));
}

function hasValidReps(value: string): boolean {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0;
}

/**
 * Figma-aligned set table for the active exercise.
 *
 * @param props Real completed sets plus the current weight input owned by the guided session hook.
 * @returns A table-like checklist preserving the existing complete-set test IDs.
 * @example
 * <SetCheckList targetSets={3} targetReps={8} completedCount={1} weight="75" onWeightChange={() => {}} onCompleteSet={() => {}} busy={false} />
 */
export function SetCheckList({
  targetSets,
  targetReps,
  completedCount,
  completedSets = [],
  weight,
  onWeightChange,
  reps,
  onRepsChange,
  onCompleteSet,
  busy,
  nextExerciseName,
}: SetCheckListProps) {
  const safeCompleted = Math.min(Math.max(completedSets.length || completedCount, 0), targetSets);
  const slots = Array.from({ length: targetSets }, (_, index) => index + 1);
  const activeSet = safeCompleted < targetSets ? safeCompleted + 1 : null;

  return (
    <div data-testid="set-checklist">
      <div
        className="grid grid-cols-[2.5rem_minmax(7rem,1fr)_minmax(6.5rem,0.9fr)_2.25rem] gap-2 rounded-t-2xl border border-line bg-surface px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted"
        role="row"
      >
        <span>SERIE</span>
        <span className="text-center">CARGA (KG)</span>
        <span className="text-center">REPS</span>
        <span className="text-right">ESTADO</span>
      </div>
      <ol className="mb-0 divide-y divide-line rounded-b-2xl border-x border-b border-line bg-surface">
        {slots.map((slot) => {
          const completed = completedSets[slot - 1];
          const done = slot <= safeCompleted;
          const active = slot === activeSet;
          if (active) {
            return (
              <li key={slot} className="bg-brand-muted/40 px-3 py-3" data-testid="set-active">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-[-0.01em] text-brand">
                    <span aria-hidden>● </span>
                    {SESSION_COPY.activeSetLabel(slot)}
                  </p>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-brand ring-1 ring-line">
                    {SESSION_COPY.targetReps(targetReps)}
                  </span>
                </div>
                <div className="grid grid-cols-[2.5rem_minmax(7rem,1fr)_minmax(6.5rem,0.9fr)_2.25rem] items-center gap-2">
                  <span className="text-sm font-semibold text-brand">{slot}</span>
                  <div className="rounded-xl bg-surface p-2 ring-1 ring-line">
                    <div className="mb-2 flex items-center justify-between">
                      <label htmlFor="guided-weight" className="text-[10px] font-medium uppercase text-ink-muted">
                        Peso
                      </label>
                      <span className="text-[10px] text-ink-muted">Paso ±2.5 kg</span>
                    </div>
                    <div className="grid grid-cols-[2rem_minmax(4.5rem,1fr)_auto_2rem] items-center gap-1.5">
                      <button
                        type="button"
                        className="size-8 rounded-md bg-canvas text-lg font-semibold text-ink"
                        onClick={() => onWeightChange(stepWeight(weight, -2.5))}
                        aria-label="Bajar peso 2.5 kg"
                        aria-pressed={false}
                        disabled={busy}
                      >
                        −
                      </button>
                      <input
                        id="guided-weight"
                        className="min-w-[4.5rem] rounded-md bg-canvas px-1 text-center text-lg font-bold text-ink outline-none ring-1 ring-line focus:ring-brand"
                        inputMode="decimal"
                        value={weight}
                        onChange={(event) => onWeightChange(event.target.value)}
                        aria-label={SESSION_COPY.weightLabel}
                        data-testid="guided-weight-input"
                      />
                      <span className="text-xs text-ink-muted">kg</span>
                      <button
                        type="button"
                        className="size-8 rounded-md bg-canvas text-lg font-semibold text-ink"
                        onClick={() => onWeightChange(stepWeight(weight, 2.5))}
                        aria-label="Subir peso 2.5 kg"
                        aria-pressed={false}
                        disabled={busy}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="rounded-xl bg-surface p-2 ring-1 ring-line">
                    <div className="mb-2 flex items-center justify-between">
                      <label htmlFor="guided-reps" className="text-[10px] font-medium uppercase text-ink-muted">
                        Reps
                      </label>
                      <span className="text-[10px] text-ink-muted">Paso ±1</span>
                    </div>
                    <div className="grid grid-cols-[2rem_minmax(2.75rem,1fr)_auto_2rem] items-center gap-1.5">
                      <button
                        type="button"
                        className="size-8 rounded-md bg-canvas text-lg font-semibold text-ink"
                        onClick={() => onRepsChange(stepReps(reps, -1, targetReps))}
                        aria-label="Bajar repeticiones 1"
                        aria-pressed={false}
                        disabled={busy}
                      >
                        −
                      </button>
                      <input
                        id="guided-reps"
                        className="min-w-[2.75rem] rounded-md bg-canvas px-1 text-center text-lg font-bold text-ink outline-none ring-1 ring-line focus:ring-brand"
                        inputMode="numeric"
                        value={reps}
                        onChange={(event) => onRepsChange(event.target.value)}
                        aria-label="Repeticiones"
                        data-testid="guided-reps-input"
                      />
                      <span className="text-xs text-ink-muted">reps</span>
                      <button
                        type="button"
                        className="size-8 rounded-md bg-canvas text-lg font-semibold text-ink"
                        onClick={() => onRepsChange(stepReps(reps, 1, targetReps))}
                        aria-label="Subir repeticiones 1"
                        aria-pressed={false}
                        disabled={busy}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <span className="text-right text-brand" aria-hidden>
                    ●
                  </span>
                </div>
              </li>
            );
          }
          return (
            <li
              key={slot}
              className="grid grid-cols-[2.5rem_minmax(7rem,1fr)_minmax(6.5rem,0.9fr)_2.25rem] items-center gap-2 px-3 py-3 text-sm"
              data-testid={done ? 'set-complete' : 'set-pending'}
            >
              <span className={done ? 'text-ink' : 'text-ink-muted'}>{slot}</span>
              <span className={done ? 'text-center text-xl font-medium text-ink' : 'text-center text-xl text-ink-muted'}>
                {completed?.weightKg ?? '—'}
              </span>
              <span className={done ? 'text-center text-xl font-medium text-ink' : 'text-center text-xl text-ink-muted'}>
                {completed?.reps ?? targetReps}
              </span>
              <span className="text-right text-ink-muted" aria-hidden>
                {done ? '✓' : '◌'}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="flex items-center justify-between border-x border-b border-line bg-surface px-3 py-3 text-sm font-semibold text-brand">
        <button type="button" className="text-left" disabled aria-disabled="true">
          {SESSION_COPY.addSet}
        </button>
        <button type="button" className="text-right text-ink-muted" disabled aria-disabled="true">
          {SESSION_COPY.warmup}
        </button>
      </div>
      {activeSet ? (
        <div className="mt-4 space-y-2 rounded-2xl bg-surface p-3 ring-1 ring-line">
          <Button
            size="lg"
            className="min-h-12 rounded-lg text-base font-bold"
            onClick={onCompleteSet}
            disabled={busy || !weight.trim() || !hasValidReps(reps)}
            data-testid="complete-set-button"
          >
            {SESSION_COPY.completeSetCta(activeSet)}
          </Button>
          {nextExerciseName ? (
            <p className="text-center text-xs text-ink-muted">Siguiente: {nextExerciseName}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
