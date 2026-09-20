import { parseApiErrorBody } from '@/lib/routines/parse-error';
import type { ApiError } from '@/types/errors';
import type {
  CoachAdaptationContext,
  CoachAdaptationResult,
  CoachExerciseDelta,
  CoachExerciseDeltaAction,
  CoachRecommendationSource,
  CoachRoutineSummary,
} from '@/types/coach';

export type CoachPreviewClientInput = {
  routineId: number;
  energy?: CoachAdaptationContext['energy'];
  mood?: CoachAdaptationContext['mood'];
  freeText?: string;
};

export type CoachPreviewClientErrorKind = 'unauthorized' | 'validation' | 'not_found' | 'generic';

export class CoachPreviewClientError extends Error {
  constructor(
    public kind: CoachPreviewClientErrorKind,
    message: string,
    public status: number,
    public api: ApiError | null = null,
  ) {
    super(message);
    this.name = 'CoachPreviewClientError';
  }
}

/**
 * Requests a read-only Coach Atlas adaptation preview for the authenticated user.
 *
 * @param input Routine id plus optional user-reported energy, mood, and free text.
 * @returns A validated original-vs-adapted Coach Atlas preview.
 * @throws {CoachPreviewClientError} When the request fails or the API body is invalid.
 * @example
 * const preview = await previewCoachAdaptation({ routineId: 10, energy: 'low', mood: 2 });
 */
export async function previewCoachAdaptation(
  input: CoachPreviewClientInput,
): Promise<CoachAdaptationResult> {
  const response = await fetch('/api/coach/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await readBody(response);

  if (!response.ok) {
    throw mapCoachPreviewHttpError(response.status, body);
  }

  const parsed = parseCoachAdaptationResult(body);
  if (!parsed) {
    throw new CoachPreviewClientError(
      'generic',
      'No se pudo cargar la adaptación de Coach Atlas',
      response.status,
    );
  }

  return parsed;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch {
    return null;
  }
}

function mapCoachPreviewHttpError(status: number, body: unknown): CoachPreviewClientError {
  const api = parseApiErrorBody(body);
  if (status === 401 || api?.code === 'UNAUTHORIZED') {
    return new CoachPreviewClientError(
      'unauthorized',
      api?.message || 'Autenticación requerida',
      status,
      api,
    );
  }

  if (status === 400 || api?.code === 'VALIDATION') {
    return new CoachPreviewClientError(
      'validation',
      api?.message || 'Preview de Coach Atlas inválido',
      status,
      api,
    );
  }

  if (status === 404 || api?.code === 'NOT_FOUND') {
    return new CoachPreviewClientError(
      'not_found',
      api?.message || 'Rutina no encontrada',
      status,
      api,
    );
  }

  return new CoachPreviewClientError(
    'generic',
    api?.message || 'No se pudo cargar la adaptación de Coach Atlas',
    status,
    api,
  );
}

function parseCoachAdaptationResult(value: unknown): CoachAdaptationResult | null {
  if (!isRecord(value) || !Array.isArray(value.exerciseDeltas)) {
    return null;
  }

  const original = parseSummary(value.original);
  const adapted = parseSummary(value.adapted);
  const exerciseDeltas = parseDeltas(value.exerciseDeltas);

  if (
    !original ||
    !adapted ||
    !exerciseDeltas ||
    typeof value.reason !== 'string' ||
    !isRecommendationSource(value.source)
  ) {
    return null;
  }

  return {
    original,
    adapted,
    exerciseDeltas,
    reason: value.reason,
    source: value.source,
  };
}

function parseSummary(value: unknown): CoachRoutineSummary | null {
  if (
    !isRecord(value) ||
    !isNonNegativeInteger(value.exerciseCount) ||
    !isNonNegativeInteger(value.setCount) ||
    !isNonNegativeInteger(value.estMinutes)
  ) {
    return null;
  }

  return {
    exerciseCount: value.exerciseCount,
    setCount: value.setCount,
    estMinutes: value.estMinutes,
  };
}

function parseDeltas(values: unknown[]): CoachExerciseDelta[] | null {
  const parsed: CoachExerciseDelta[] = [];
  for (const value of values) {
    const delta = parseDelta(value);
    if (!delta) {
      return null;
    }
    parsed.push(delta);
  }
  return parsed;
}

function parseDelta(value: unknown): CoachExerciseDelta | null {
  if (
    !isRecord(value) ||
    !isPositiveInteger(value.exerciseId) ||
    typeof value.name !== 'string' ||
    !isDeltaAction(value.action) ||
    !isNonNegativeInteger(value.fromSets) ||
    !isNonNegativeInteger(value.toSets)
  ) {
    return null;
  }

  return {
    exerciseId: value.exerciseId,
    name: value.name,
    action: value.action,
    fromSets: value.fromSets,
    toSets: value.toSets,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isDeltaAction(value: unknown): value is CoachExerciseDeltaAction {
  return value === 'kept' || value === 'reduced' || value === 'removed';
}

function isRecommendationSource(value: unknown): value is CoachRecommendationSource {
  return value === 'deterministic' || value === 'ai';
}
