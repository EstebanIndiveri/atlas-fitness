import { parseApiErrorBody } from '@/lib/routines/parse-error';
import type { ApiError } from '@/types/errors';
import type {
  ExerciseProgression,
  ProgressionCohort,
  ProgressionHistoryItem,
  ProgressionHistoryPage,
  ProgressionReadStatus,
  ProgressionSemantics,
  ProgressionSourceSet,
} from '@/types/progression-read';
import type { ProgressionComparison } from '@/types/progression';

/**
 * Browser-side typed client for the truthful progression read model
 * (Atlas v0.12, Workstream D → F).
 *
 * The server owns eligibility and comparison; this client only fetches the
 * requested exact cohort and rejects malformed bodies so no invented claim can
 * reach the UI. Values are surfaced verbatim; nothing is recomputed here.
 */

const GENERIC_MESSAGE = 'No pudimos cargar tu progresión comparable.';

export type ExerciseProgressionClientErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'generic';

/** Typed failure for the progression client. */
export class ExerciseProgressionClientError extends Error {
  constructor(
    public kind: ExerciseProgressionClientErrorKind,
    message: string,
    public status: number,
    public api: ApiError | null = null,
  ) {
    super(message);
    this.name = 'ExerciseProgressionClientError';
  }
}

export interface ProgressionQueryCohort {
  reps: number;
  amountBasis: 'total' | 'per_side';
  side: 'bilateral' | 'left' | 'right';
}

export interface FetchExerciseProgressionOptions {
  limit?: number;
  cursor?: string | null;
}

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

const LOAD_MODES = ['external', 'bodyweight', 'bodyweight_added', 'assisted'] as const;
const AMOUNT_BASES = ['total', 'per_side'] as const;
const SIDES = ['bilateral', 'left', 'right', 'alternating'] as const;
const SET_PURPOSES = ['working', 'warmup'] as const;
const REP_COUNT_BASES = ['total', 'per_side'] as const;
const READ_STATUSES: readonly ProgressionReadStatus[] = [
  'no_history',
  'history_without_semantics',
  'no_comparable_set',
  'ready',
];
const COMPARISONS: readonly ProgressionComparison[] = [
  'baseline',
  'new_pr',
  'ties_best',
  'below_best',
];

function isSemantics(value: unknown): value is ProgressionSemantics {
  return (
    isRecord(value) &&
    isPositiveInteger(value.semanticCaptureVersion) &&
    typeof value.loadMode === 'string' &&
    (LOAD_MODES as readonly string[]).includes(value.loadMode) &&
    isStringOrNull(value.amountBasis) &&
    (value.amountBasis === null ||
      (AMOUNT_BASES as readonly string[]).includes(value.amountBasis)) &&
    typeof value.side === 'string' &&
    (SIDES as readonly string[]).includes(value.side) &&
    typeof value.setPurpose === 'string' &&
    (SET_PURPOSES as readonly string[]).includes(value.setPurpose) &&
    isStringOrNull(value.repCountBasis) &&
    (value.repCountBasis === null ||
      (REP_COUNT_BASES as readonly string[]).includes(value.repCountBasis))
  );
}

function isSourceSet(value: unknown): value is ProgressionSourceSet {
  return (
    isRecord(value) &&
    isPositiveInteger(value.setId) &&
    isPositiveInteger(value.workoutId) &&
    isNonNegativeInteger(value.setIndex) &&
    isPositiveInteger(value.reps) &&
    typeof value.weightKg === 'string' &&
    typeof value.endedAt === 'string' &&
    typeof value.localDate === 'string' &&
    isSemantics(value.semantics) &&
    value.provenance === 'user_input'
  );
}

function isNullableSourceSet(value: unknown): value is ProgressionSourceSet | null {
  return value === null || isSourceSet(value);
}

function isHistoryItem(value: unknown): value is ProgressionHistoryItem {
  return (
    isRecord(value) &&
    isPositiveInteger(value.setId) &&
    isPositiveInteger(value.workoutId) &&
    isNonNegativeInteger(value.setIndex) &&
    isPositiveInteger(value.reps) &&
    typeof value.weightKg === 'string' &&
    isStringOrNull(value.endedAt) &&
    isStringOrNull(value.localDate) &&
    (value.semantics === null || isSemantics(value.semantics)) &&
    isStringOrNull(value.setPurpose) &&
    typeof value.comparable === 'boolean'
  );
}

function isHistoryPage(value: unknown): value is ProgressionHistoryPage {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isHistoryItem) &&
    isStringOrNull(value.nextCursor) &&
    isPositiveInteger(value.limit) &&
    value.bounded === true
  );
}

function isCohort(value: unknown): value is ProgressionCohort {
  return (
    isRecord(value) &&
    isPositiveInteger(value.exerciseId) &&
    value.loadMode === 'external' &&
    typeof value.amountBasis === 'string' &&
    (AMOUNT_BASES as readonly string[]).includes(value.amountBasis) &&
    typeof value.side === 'string' &&
    (value.side === 'bilateral' || value.side === 'left' || value.side === 'right') &&
    isPositiveInteger(value.reps)
  );
}

/**
 * Total parser for the progression read model. Returns `null` when the body
 * does not match the contract, so the UI shows an error instead of a partial
 * or misread claim.
 */
export function parseExerciseProgression(value: unknown): ExerciseProgression | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    value.metricId !== 'same_reps_external_load' ||
    !isPositiveInteger(value.progressionRuleVersion) ||
    !READ_STATUSES.includes(value.readStatus as ProgressionReadStatus) ||
    !isCohort(value.cohort) ||
    !isNullableSourceSet(value.currentRepresentative) ||
    !isNullableSourceSet(value.previousComparableRepresentative) ||
    !isNullableSourceSet(value.currentBest) ||
    !(value.comparison === null || COMPARISONS.includes(value.comparison as ProgressionComparison)) ||
    !Array.isArray(value.reasons) ||
    !value.reasons.every((reason) => typeof reason === 'string') ||
    !isHistoryPage(value.history) ||
    value.provenance !== 'atlas_computed'
  ) {
    return null;
  }
  return value as unknown as ExerciseProgression;
}

function progressionUrl(exerciseId: number, cohort: ProgressionQueryCohort, options: FetchExerciseProgressionOptions): string {
  const params = new URLSearchParams({
    reps: String(cohort.reps),
    amountBasis: cohort.amountBasis,
    side: cohort.side,
  });
  if (options.limit !== undefined) {
    params.set('limit', String(options.limit));
  }
  if (options.cursor) {
    params.set('cursor', options.cursor);
  }
  return `/api/exercises/${exerciseId}/progression?${params.toString()}`;
}

async function readBody(response: Response): Promise<unknown | null> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function mapHttpError(status: number, body: unknown): ExerciseProgressionClientError {
  const api = parseApiErrorBody(body);
  const message = api?.message || GENERIC_MESSAGE;

  if (status === 401 || api?.code === 'UNAUTHORIZED') {
    return new ExerciseProgressionClientError('unauthorized', api?.message || 'Autenticación requerida', status, api);
  }
  if (status === 403 || api?.code === 'FORBIDDEN') {
    return new ExerciseProgressionClientError('forbidden', api?.message || 'Sin permiso para este ejercicio', status, api);
  }
  if (status === 404 || api?.code === 'NOT_FOUND') {
    return new ExerciseProgressionClientError('not_found', api?.message || 'Ejercicio no encontrado', status, api);
  }
  if (status === 400 || api?.code === 'VALIDATION') {
    return new ExerciseProgressionClientError('validation', api?.message || 'Cohorte de progresión inválida', status, api);
  }
  return new ExerciseProgressionClientError('generic', message, status, api);
}

/**
 * Fetches the truthful progression summary for one exact external cohort.
 *
 * @param exerciseId Exact exercise id.
 * @param cohort Requested reps/basis/side; `external` + `working` are fixed by the metric.
 * @param options Optional bounded history parameters.
 * @returns The parsed read model.
 * @throws {ExerciseProgressionClientError} On HTTP failure or a malformed body.
 */
export async function fetchExerciseProgression(
  exerciseId: number,
  cohort: ProgressionQueryCohort,
  options: FetchExerciseProgressionOptions = {},
): Promise<ExerciseProgression> {
  const response = await fetch(progressionUrl(exerciseId, cohort, options));
  const body = await readBody(response);

  if (!response.ok) {
    throw mapHttpError(response.status, body);
  }

  const parsed = parseExerciseProgression(body);
  if (!parsed) {
    throw new ExerciseProgressionClientError('generic', GENERIC_MESSAGE, response.status);
  }

  return parsed;
}
