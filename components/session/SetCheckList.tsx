'use client';

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

const SET_TABLE_GRID_CLASS =
  'grid-cols-[2.5rem_minmax(0,1fr)_minmax(2.75rem,0.65fr)_2.75rem]';

function parseWeightCents(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(normalized);
  if (!match) {
    return null;
  }
  const [, integerPart, decimalPart = ''] = match;
  const cents = `${decimalPart}00`.slice(0, 2);
  return Number.parseInt(integerPart, 10) * 100 + Number.parseInt(cents, 10);
}

function formatWeightCents(value: number): string {
  const safeValue = Math.max(0, value);
  const kilos = Math.floor(safeValue / 100);
  const cents = safeValue % 100;
  if (cents === 0) {
    return String(kilos);
  }
  if (cents % 10 === 0) {
    return `${kilos}.${cents / 10}`;
  }
  return `${kilos}.${String(cents).padStart(2, '0')}`;
}

function stepWeight(value: string, delta: number): string {
  const base = parseWeightCents(value) ?? 0;
  const step = delta > 0 ? 250 : -250;
  return formatWeightCents(base + step);
}

function stepReps(value: string, delta: number, fallback: number): string {
  const parsed = Number.parseInt(value, 10);
  const base = Number.isFinite(parsed) ? parsed : fallback;
  return String(Math.max(1, base + delta));
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
  busy,
}: SetCheckListProps) {
  const safeCompleted = Math.min(Math.max(completedSets.length || completedCount, 0), targetSets);
  const slots = Array.from({ length: targetSets }, (_, index) => index + 1);
  const activeSet = safeCompleted < targetSets ? safeCompleted + 1 : null;

  return (
    <div data-testid="set-checklist">
      <div
        className={`grid ${SET_TABLE_GRID_CLASS} gap-1.5 rounded-t-2xl border border-line bg-surface px-2.5 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-muted`}
        role="row"
      >
        <span role="columnheader">SERIE</span>
        <span className="min-w-0 text-center" role="columnheader">
          CARGA (KG)
        </span>
        <span className="text-center" role="columnheader">
          REPS
        </span>
        <span className="text-right" role="columnheader">
          ESTADO
        </span>
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
                  <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-brand ring-1 ring-line">
                    {SESSION_COPY.targetReps(targetReps)}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2">
                  <div className="rounded-xl bg-surface p-3 ring-1 ring-line">
                    <div className="mb-2 flex items-baseline justify-between gap-1">
                      <label htmlFor="guided-weight" className="text-[10px] font-medium uppercase text-ink-muted">
                        Peso (kg)
                      </label>
                      <span className="shrink-0 text-[10px] text-ink-muted">Paso ±2.5 kg</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="size-9 shrink-0 rounded-md bg-canvas text-xl font-semibold leading-none text-ink"
                        onClick={() => onWeightChange(stepWeight(weight, -2.5))}
                        aria-label="Bajar peso 2.5 kg"
                        aria-pressed={false}
                        disabled={busy}
                      >
                        −
                      </button>
                      <input
                        id="guided-weight"
                        className="w-full min-w-[5.5rem] rounded-md bg-canvas px-2 py-1.5 text-center text-lg font-bold tabular-nums text-ink outline-none ring-1 ring-line focus:ring-brand"
                        inputMode="decimal"
                        value={weight}
                        onChange={(event) => onWeightChange(event.target.value)}
                        aria-label={SESSION_COPY.weightLabel}
                        data-testid="guided-weight-input"
                      />
                      <button
                        type="button"
                        className="size-9 shrink-0 rounded-md bg-canvas text-xl font-semibold leading-none text-ink"
                        onClick={() => onWeightChange(stepWeight(weight, 2.5))}
                        aria-label="Subir peso 2.5 kg"
                        aria-pressed={false}
                        disabled={busy}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="rounded-xl bg-surface p-3 ring-1 ring-line">
                    <div className="mb-2 flex items-baseline justify-between gap-1">
                      <label htmlFor="guided-reps" className="text-[10px] font-medium uppercase text-ink-muted">
                        Reps
                      </label>
                      <span className="shrink-0 text-[10px] text-ink-muted">Paso ±1</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="size-9 shrink-0 rounded-md bg-canvas text-xl font-semibold leading-none text-ink"
                        onClick={() => onRepsChange(stepReps(reps, -1, targetReps))}
                        aria-label="Bajar repeticiones 1"
                        aria-pressed={false}
                        disabled={busy}
                      >
                        −
                      </button>
                      <input
                        id="guided-reps"
                        className="w-full min-w-[3.25rem] rounded-md bg-canvas px-1 py-1.5 text-center text-lg font-bold tabular-nums text-ink outline-none ring-1 ring-line focus:ring-brand"
                        inputMode="numeric"
                        value={reps}
                        onChange={(event) => onRepsChange(event.target.value)}
                        aria-label="Repeticiones"
                        data-testid="guided-reps-input"
                      />
                      <button
                        type="button"
                        className="size-9 shrink-0 rounded-md bg-canvas text-xl font-semibold leading-none text-ink"
                        onClick={() => onRepsChange(stepReps(reps, 1, targetReps))}
                        aria-label="Subir repeticiones 1"
                        aria-pressed={false}
                        disabled={busy}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          }
          return (
            <li
              key={slot}
              className={`grid ${SET_TABLE_GRID_CLASS} items-center gap-1.5 px-2.5 py-3 text-sm`}
              data-testid={done ? 'set-complete' : 'set-pending'}
            >
              <span className={done ? 'text-ink' : 'text-ink-muted'}>{slot}</span>
              <span
                className={
                  done
                    ? 'min-w-0 text-center text-lg font-medium tabular-nums text-ink'
                    : 'min-w-0 text-center text-lg tabular-nums text-ink-muted'
                }
              >
                {completed?.weightKg ?? '—'}
              </span>
              <span
                className={
                  done
                    ? 'text-center text-lg font-medium tabular-nums text-ink'
                    : 'text-center text-lg tabular-nums text-ink-muted'
                }
              >
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
    </div>
  );
}
