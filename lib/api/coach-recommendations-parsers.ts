import type { CoachRecommendationDto } from '@/lib/services/coach-recommendation';
import type {
  CoachAdaptationResult,
  CoachExerciseDelta,
  CoachExerciseDeltaAction,
  CoachRecommendationSource,
  CoachRoutineSummary,
} from '@/types/coach';

/**
 * Parses an unknown API body into a Coach recommendation DTO.
 *
 * @param value Unknown JSON body returned by the recommendation endpoints.
 * @returns A typed DTO when the body matches the contract, otherwise null.
 * @example
 * const dto = parseCoachRecommendationDto(await response.json());
 */
export function parseCoachRecommendationDto(value: unknown): CoachRecommendationDto | null {
  if (!isRecord(value)) return null;

  const result = parseCoachAdaptationResult(value.result);
  if (
    !isPositiveInteger(value.id) ||
    !isPositiveInteger(value.userId) ||
    !isPositiveInteger(value.workoutId) ||
    !isNullablePositiveInteger(value.dailyCheckInId) ||
    !isRecommendationSource(value.source) ||
    !result ||
    !isDecision(value.decision) ||
    !isNullableString(value.decidedAt) ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null;
  }

  return {
    id: value.id,
    userId: value.userId,
    workoutId: value.workoutId,
    dailyCheckInId: value.dailyCheckInId,
    contextSnapshot: value.contextSnapshot ?? null,
    source: value.source,
    result,
    decision: value.decision,
    decidedAt: value.decidedAt,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function parseCoachAdaptationResult(value: unknown): CoachAdaptationResult | null {
  if (!isRecord(value) || !Array.isArray(value.exerciseDeltas)) return null;

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

  return { original, adapted, exerciseDeltas, reason: value.reason, source: value.source };
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
    if (!delta) return null;
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

function isNullablePositiveInteger(value: unknown): value is number | null {
  return value === null || isPositiveInteger(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isDeltaAction(value: unknown): value is CoachExerciseDeltaAction {
  return value === 'kept' || value === 'reduced' || value === 'removed';
}

function isRecommendationSource(value: unknown): value is CoachRecommendationSource {
  return value === 'deterministic' || value === 'ai';
}

function isDecision(value: unknown): value is CoachRecommendationDto['decision'] {
  return value === 'pending' || value === 'accepted' || value === 'rejected';
}
