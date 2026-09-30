import type { AmountBasis, CanonicalSemantics, LoadMode, RepCountBasis } from '@/types/progression';

/**
 * Mode-aware amount display for v0.12 (es-AR).
 *
 * A bare `weightKg` never means "kg levantados": the same column is external
 * load, added load, assistance magnitude or the sentinel zero of plain
 * bodyweight. These helpers make the recorded meaning explicit for UI/Telegram
 * copy without any arithmetic normalization or float math.
 */

/** Label shown for a legacy/unknown row, which has no declared semantics. */
export const LEGACY_AMOUNT_LABEL = 'carga registrada (sin contexto)';

/** Human label for each load mode, used by capture controls. */
export const LOAD_MODE_LABELS: Readonly<Record<LoadMode, string>> = {
  external: 'Carga externa',
  bodyweight: 'Peso corporal',
  bodyweight_added: 'Peso corporal + carga',
  assisted: 'Asistida',
};

/** Human label for each side. */
export const SIDE_LABELS: Readonly<Record<CanonicalSemantics['side'], string>> = {
  bilateral: 'Bilateral',
  left: 'Izquierda',
  right: 'Derecha',
  alternating: 'Alternado',
};

/** Human label for each amount basis. */
export const AMOUNT_BASIS_LABELS: Readonly<Record<AmountBasis, string>> = {
  total: 'Total',
  per_side: 'Por lado',
};

/** Human label for each rep-count basis of an alternating set. */
export const REP_COUNT_BASIS_LABELS: Readonly<Record<RepCountBasis, string>> = {
  total: 'Reps totales',
  per_side: 'Reps por lado',
};

/** Human label for each set purpose. */
export const SET_PURPOSE_LABELS: Readonly<Record<CanonicalSemantics['setPurpose'], string>> = {
  working: 'Serie efectiva',
  warmup: 'Calentamiento',
};

/**
 * Describes a recorded amount from its canonical semantics. Never claims a
 * generic "kg lifted" and never multiplies a per-side amount.
 */
export function describeRecordedAmount(canonical: CanonicalSemantics, weightKg: string): string {
  const { loadMode, amountBasis, side, repCountBasis } = canonical;
  const perSide = amountBasis === 'per_side';
  const alternatingSuffix =
    side === 'alternating'
      ? ` (alternado, ${repCountBasis === 'per_side' ? 'reps por lado' : 'reps totales'})`
      : '';

  if (loadMode === 'bodyweight') {
    return 'peso corporal (sin carga externa)';
  }
  if (loadMode === 'assisted') {
    return `asistencia ${weightKg} kg${perSide ? ' por lado' : ''}${alternatingSuffix}`;
  }
  if (loadMode === 'bodyweight_added') {
    return `+${weightKg} kg agregados${perSide ? ' por lado' : ''}${alternatingSuffix}`;
  }

  const base = perSide ? `${weightKg} kg por lado` : `${weightKg} kg`;
  return `${base}${alternatingSuffix}`;
}

/**
 * Compact variant for table cells / dense lists where the full sentence would
 * not fit. Still mode-aware: bodyweight never shows "0 kg".
 */
export function formatCompactAmount(canonical: CanonicalSemantics, weightKg: string): string {
  const { loadMode, amountBasis } = canonical;
  const perSide = amountBasis === 'per_side' ? '/lado' : '';
  if (loadMode === 'bodyweight') {
    return 'PC';
  }
  if (loadMode === 'assisted') {
    return `asist. ${weightKg}${perSide}`;
  }
  if (loadMode === 'bodyweight_added') {
    return `+${weightKg}${perSide}`;
  }
  return `${weightKg}${perSide}`;
}
