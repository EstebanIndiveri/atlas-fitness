import { parseApiErrorBody } from '@/lib/routines/parse-error';
import { parseCoachRecommendationDto } from '@/lib/api/coach-recommendations-parsers';
import type { CoachRecommendationDto } from '@/lib/services/coach-recommendation';
import type { ApiError } from '@/types/errors';
import type {
  CoachAdaptationResult,
  CoachRecommendationSource,
} from '@/types/coach';

export type RecordCoachRecommendationClientInput = {
  workoutId: number;
  dailyCheckInId?: number;
  contextSnapshot?: unknown;
  source: CoachRecommendationSource;
  result: CoachAdaptationResult;
};

export type DecideCoachRecommendationClientInput = {
  id: number;
  decision: 'accepted' | 'rejected';
};

export type CoachRecommendationsClientErrorKind =
  | 'unauthorized'
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'generic';

export class CoachRecommendationsClientError extends Error {
  constructor(
    public kind: CoachRecommendationsClientErrorKind,
    message: string,
    public status: number,
    public api: ApiError | null = null,
  ) {
    super(message);
    this.name = 'CoachRecommendationsClientError';
  }
}

/**
 * Persists a Coach Atlas preview recommendation for the authenticated user.
 *
 * @param input Workout id, optional context, source, and adaptation result to persist.
 * @returns The persisted Coach Atlas recommendation DTO.
 * @throws {CoachRecommendationsClientError} When the request fails or the API body is invalid.
 * @example
 * const recommendation = await recordCoachRecommendation({ workoutId: 10, source: result.source, result });
 */
export async function recordCoachRecommendation(
  input: RecordCoachRecommendationClientInput,
): Promise<CoachRecommendationDto> {
  const response = await fetch('/api/coach/recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  return readRecommendationResponse(response);
}

/**
 * Accepts or rejects a persisted Coach Atlas recommendation for the authenticated user.
 *
 * @param input Recommendation id and final user decision.
 * @returns The decided Coach Atlas recommendation DTO.
 * @throws {CoachRecommendationsClientError} When the request fails or the API body is invalid.
 * @example
 * await decideCoachRecommendation({ id: recommendation.id, decision: 'accepted' });
 */
export async function decideCoachRecommendation(
  input: DecideCoachRecommendationClientInput,
): Promise<CoachRecommendationDto> {
  const response = await fetch(`/api/coach/recommendations/${input.id}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision: input.decision }),
  });

  return readRecommendationResponse(response);
}

async function readRecommendationResponse(response: Response): Promise<CoachRecommendationDto> {
  const body = await readBody(response);

  if (!response.ok) {
    throw mapCoachRecommendationsHttpError(response.status, body);
  }

  const parsed = parseCoachRecommendationDto(body);
  if (!parsed) {
    throw new CoachRecommendationsClientError(
      'generic',
      'No se pudo guardar la recomendación de Coach Atlas',
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

function mapCoachRecommendationsHttpError(
  status: number,
  body: unknown,
): CoachRecommendationsClientError {
  const api = parseApiErrorBody(body);
  if (status === 401 || api?.code === 'UNAUTHORIZED') {
    return new CoachRecommendationsClientError(
      'unauthorized',
      api?.message || 'Autenticación requerida',
      status,
      api,
    );
  }

  if (status === 400 || api?.code === 'VALIDATION') {
    return new CoachRecommendationsClientError(
      'validation',
      api?.message || 'Recomendación de Coach Atlas inválida',
      status,
      api,
    );
  }

  if (status === 404 || api?.code === 'NOT_FOUND') {
    return new CoachRecommendationsClientError(
      'not_found',
      api?.message || 'Recomendación no encontrada',
      status,
      api,
    );
  }

  if (status === 409 || api?.code === 'CONFLICT') {
    return new CoachRecommendationsClientError(
      'conflict',
      api?.message || 'La recomendación ya fue decidida',
      status,
      api,
    );
  }

  return new CoachRecommendationsClientError(
    'generic',
    api?.message || 'No se pudo guardar la recomendación de Coach Atlas',
    status,
    api,
  );
}
