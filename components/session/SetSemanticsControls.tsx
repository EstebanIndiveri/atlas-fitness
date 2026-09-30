'use client';

import { SESSION_COPY } from '@/lib/copy/session';
import {
  AMOUNT_BASIS_LABELS,
  LOAD_MODE_LABELS,
  REP_COUNT_BASIS_LABELS,
  SET_PURPOSE_LABELS,
  SIDE_LABELS,
} from '@/lib/format/amount';
import { cn } from '@/lib/ui/cn';
import {
  AMOUNT_BASES,
  LOAD_MODES,
  REP_COUNT_BASES,
  SET_PURPOSES,
  SIDES,
} from '@/types/progression';
import type { AmountBasis, LoadMode, RepCountBasis, SetPurpose, Side } from '@/types/progression';
import type { SessionSemanticsControls } from '@/lib/session/semantics-draft';

function Chip({
  label,
  active,
  testId,
  onSelect,
}: {
  label: string;
  active: boolean;
  testId: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 transition',
        active
          ? 'bg-brand text-brand-foreground ring-brand'
          : 'bg-canvas text-ink-muted ring-line',
      )}
      aria-pressed={active}
      data-testid={testId}
      onClick={onSelect}
    >
      {label}
    </button>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/**
 * Explicit v0.12 capture controls for the active set. Every value is chosen
 * visibly by the user; nothing is inferred from the exercise, routine or
 * history. The controls stay mounted and editable for subsequent sets, where
 * they simply start from the last confirmed tuple (marked as reused).
 */
export function SetSemanticsControls(controls: SessionSemanticsControls) {
  const { draft, reused } = controls;
  const showBasis = draft.loadMode !== '' && draft.loadMode !== 'bodyweight';
  const showRepBasis = draft.side === 'alternating';

  return (
    <div className="mb-3 flex flex-col gap-3" data-testid="set-semantics-controls">
      {reused ? (
        <p className="text-[11px] font-medium text-brand" data-testid="semantics-reused">
          {SESSION_COPY.semanticsReused}
        </p>
      ) : null}
      <Group label={SESSION_COPY.semanticsTitle}>
        {LOAD_MODES.map((mode: LoadMode) => (
          <Chip
            key={mode}
            label={LOAD_MODE_LABELS[mode]}
            active={draft.loadMode === mode}
            testId={`semantics-loadMode-${mode}`}
            onSelect={() => controls.onLoadMode(mode)}
          />
        ))}
      </Group>
      {showBasis ? (
        <Group label={SESSION_COPY.semanticsBasis}>
          {AMOUNT_BASES.map((basis: AmountBasis) => (
            <Chip
              key={basis}
              label={AMOUNT_BASIS_LABELS[basis]}
              active={draft.amountBasis === basis}
              testId={`semantics-amountBasis-${basis}`}
              onSelect={() => controls.onAmountBasis(basis)}
            />
          ))}
        </Group>
      ) : null}
      <Group label={SESSION_COPY.semanticsSide}>
        {SIDES.map((side: Side) => (
          <Chip
            key={side}
            label={SIDE_LABELS[side]}
            active={draft.side === side}
            testId={`semantics-side-${side}`}
            onSelect={() => controls.onSide(side)}
          />
        ))}
      </Group>
      <Group label={SESSION_COPY.semanticsPurpose}>
        {SET_PURPOSES.map((purpose: SetPurpose) => (
          <Chip
            key={purpose}
            label={SET_PURPOSE_LABELS[purpose]}
            active={draft.setPurpose === purpose}
            testId={`semantics-purpose-${purpose}`}
            onSelect={() => controls.onSetPurpose(purpose)}
          />
        ))}
      </Group>
      {showRepBasis ? (
        <Group label={SESSION_COPY.semanticsRepBasis}>
          {REP_COUNT_BASES.map((basis: RepCountBasis) => (
            <Chip
              key={basis}
              label={REP_COUNT_BASIS_LABELS[basis]}
              active={draft.repCountBasis === basis}
              testId={`semantics-repCountBasis-${basis}`}
              onSelect={() => controls.onRepCountBasis(basis)}
            />
          ))}
        </Group>
      ) : null}
    </div>
  );
}
