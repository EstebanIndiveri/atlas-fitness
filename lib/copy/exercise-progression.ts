import type { AmountBasis, ProgressionComparison, Side } from '@/types/progression';
import type { ProgressionReadStatus } from '@/types/progression-read';
import type { ProgressionUnsupportedReason } from '@/lib/session/progression-cohort';

/**
 * Honest es-AR copy for the per-exercise comparable progression surface
 * (Atlas v0.12, Workstream F).
 *
 * Wording rules (see the approved v0.12 brief §6/§11): never claim universal
 * strength, never `1RM`, never a percentage, never a trend. A verified result is
 * only a record under the exact recorded conditions; the first eligible result
 * is a baseline, and a tie is not a new record.
 */
export const PROGRESSION_COPY = {
  chip: '↗ Progresión',
  showAria: 'Mostrar progresión comparable',
  title: 'Progresión comparable',
  /** Exact metric explanation, shown with every result. */
  metricExplanation:
    'Mayor carga externa registrada para estas mismas repeticiones y condiciones registradas.',
  /** Compact, readable restatement of the exact compared conditions (never enum names). */
  cohortLabel: 'Estas condiciones',
  amountBasisLabel: {
    total: 'carga total',
    per_side: 'por lado',
  } satisfies Record<AmountBasis, string>,
  sideLabel: {
    bilateral: 'bilateral',
    left: 'izquierda',
    right: 'derecha',
  } satisfies Record<Extract<Side, 'bilateral' | 'left' | 'right'>, string>,
  cohortSummary: (reps: number, amountBasisLabel: string, sideLabel: string) =>
    `${reps} reps · ${amountBasisLabel} · ${sideLabel}`,
  /** The surface describes closed history, not the current open set. */
  closedHistoryNote:
    'Solo historial de entrenamientos cerrados. La serie que estás cargando todavía no es un récord.',
  loading: 'Buscando tu progresión comparable…',
  error: 'No pudimos cargar tu progresión comparable.',
  retry: 'Reintentar',
  sourceLabel: 'Serie de referencia',
  bestLabel: 'Mejor registro',
  previousLabel: 'Comparable anterior',
  conclusionLabel: 'Lectura',
  sourceWorkoutLink: 'Ver entrenamiento de origen',
  reps: (reps: number) => `${reps} reps`,
  comparison: {
    baseline: 'Punto de referencia',
    new_pr: 'Récord verificado para estas condiciones',
    ties_best: 'Igualó el mejor registro',
    below_best: 'Por debajo del mejor registro',
  } satisfies Record<ProgressionComparison, string>,
  status: {
    no_history: 'Todavía no hay historial registrado para estas condiciones.',
    history_without_semantics:
      'Tu historial de este ejercicio no tiene condiciones declaradas, así que no se puede comparar.',
    no_comparable_set: 'Todavía no hay una serie cerrada comparable con estas condiciones.',
  } satisfies Partial<Record<ProgressionReadStatus, string>>,
  unsupported: {
    missing_selection: 'Elegí tipo de carga, base, lado y reps para ver tu progresión comparable.',
    invalid_reps: 'Ingresá repeticiones válidas para ver tu progresión comparable.',
    warmup: 'Los calentamientos no cuentan para la progresión comparable.',
    unsupported_load_mode:
      'La progresión comparable de v0.12 solo aplica a carga externa. Peso corporal, peso añadido y asistencia quedan como historial sin comparación.',
    alternating: 'Los sets alternados todavía no son comparables.',
  } satisfies Record<ProgressionUnsupportedReason, string>,
} as const;
