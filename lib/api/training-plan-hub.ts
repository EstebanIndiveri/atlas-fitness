import { trainingPlanHubDtoSchema, type TrainingPlanHubDto } from '@/types/training-plan-hub';

export class TrainingPlanHubClientError extends Error {
  constructor(
    public kind: 'not_found' | 'generic',
    message: string,
  ) {
    super(message);
    this.name = 'TrainingPlanHubClientError';
  }
}

/**
 * Fetches a plan hub through its authenticated read-model endpoint.
 *
 * @param planId - Requested persisted plan id.
 * @returns Validated seven-day plan hub DTO.
 * @throws {TrainingPlanHubClientError} When the API returns an error or invalid data.
 * @example
 * const hub = await getTrainingPlanHub(10);
 */
export async function getTrainingPlanHub(planId: number): Promise<TrainingPlanHubDto> {
  const response = await fetch(`/api/training-plan/${planId}/hub`);
  let body: unknown = null;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (response.status === 404) {
    throw new TrainingPlanHubClientError('not_found', 'Plan no encontrado');
  }

  if (!response.ok) {
    throw new TrainingPlanHubClientError(
      'generic',
      getApiErrorMessage(body) ?? 'No pudimos cargar tu plan. Probá de nuevo.',
    );
  }

  const parsed = trainingPlanHubDtoSchema.safeParse(body);
  if (!parsed.success) {
    throw new TrainingPlanHubClientError(
      'generic',
      'La respuesta del plan no tiene un formato válido.',
    );
  }

  return parsed.data;
}

function getApiErrorMessage(value: unknown): string | null {
  if (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof value.message === 'string'
  ) {
    return value.message;
  }

  return null;
}
