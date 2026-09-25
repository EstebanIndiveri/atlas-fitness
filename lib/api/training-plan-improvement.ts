import { isWeeklyPlanDraft } from '@/lib/api/weekly-plan-draft';
import type { ConfirmTrainingPlanImprovementInput, TrainingPlanImprovementProposal } from '@/types/training-plan-improvement';
import { trainingPlanHubDtoSchema } from '@/types/training-plan-hub';

export class TrainingPlanImprovementClientError extends Error {
  constructor(
    public kind: 'not_found' | 'conflict' | 'generic',
    message: string,
  ) {
    super(message);
    this.name = 'TrainingPlanImprovementClientError';
  }
}

/**
 * Generates and validates an improvement proposal without saving it.
 *
 * @param planId - Active persisted plan selected in the plan hub.
 * @param intent - Explicit user goal for the proposed improvement.
 * @returns Server-authored current-plan snapshot and generated proposal.
 * @throws {TrainingPlanImprovementClientError} When the request fails or returns invalid data.
 * @example
 * const proposal = await generateTrainingPlanImprovement(12, 'Reducir volumen');
 */
export async function generateTrainingPlanImprovement(
  planId: number,
  intent: string,
): Promise<TrainingPlanImprovementProposal> {
  const response = await fetch(`/api/training-plan/${planId}/improve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intent }),
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw toClientError(response.status, body, 'No se pudo generar la propuesta.');
  }
  if (!isTrainingPlanImprovementProposal(body)) {
    throw new TrainingPlanImprovementClientError(
      'generic',
      'La propuesta recibida no es válida.',
    );
  }
  return body;
}

/**
 * Sends an explicit proposal confirmation to the atomic save endpoint.
 *
 * @param planId - Source plan that must still be active and unchanged.
 * @param input - Idempotency key, accepted proposal, and expected source-plan version.
 * @returns The id of the newly active plan.
 * @throws {TrainingPlanImprovementClientError} When saving fails or the response is malformed.
 * @example
 * const newPlanId = await confirmTrainingPlanImprovement(12, confirmation);
 */
export async function confirmTrainingPlanImprovement(
  planId: number,
  input: ConfirmTrainingPlanImprovementInput,
): Promise<number> {
  const response = await fetch(`/api/training-plan/${planId}/improve/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw toClientError(response.status, body, 'No se pudo guardar el plan mejorado.');
  }
  if (
    !isRecord(body)
    || !isRecord(body.plan)
    || typeof body.plan.id !== 'number'
    || !Number.isSafeInteger(body.plan.id)
    || body.plan.id < 1
  ) {
    throw new TrainingPlanImprovementClientError(
      'generic',
      'La respuesta del guardado no es válida.',
    );
  }

  return body.plan.id;
}

function isTrainingPlanImprovementProposal(
  value: unknown,
): value is TrainingPlanImprovementProposal {
  if (
    !isRecord(value)
    || typeof value.intent !== 'string'
    || typeof value.confirmationToken !== 'string'
    || value.confirmationToken.length === 0
    || value.confirmationToken.length > 20_000
    || !isRecord(value.currentPlan)
    || !isWeeklyPlanDraft(value.proposal)
    || value.proposal.goal !== value.intent
  ) {
    return false;
  }

  const snapshot = value.currentPlan;
  if (!trainingPlanHubDtoSchema.safeParse(snapshot).success) {
    return false;
  }
  if (!Array.isArray(snapshot.days)) {
    return false;
  }

  return snapshot.days.every((day) => {
    if (!isRecord(day) || !isRecord(day.assignment)) {
      return false;
    }
    const assignment = day.assignment;
    return assignment.kind !== 'routine'
      || (Array.isArray(assignment.exercises)
        && assignment.exercises.every(isSnapshotExercise));
  });
}

function isSnapshotExercise(value: unknown): boolean {
  return (
    isRecord(value)
    && typeof value.exerciseId === 'number'
    && Number.isSafeInteger(value.exerciseId)
    && value.exerciseId > 0
    && typeof value.exerciseName === 'string'
    && typeof value.targetSets === 'number'
    && Number.isInteger(value.targetSets)
    && value.targetSets > 0
    && typeof value.targetReps === 'number'
    && Number.isInteger(value.targetReps)
    && value.targetReps > 0
  );
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function toClientError(
  status: number,
  body: unknown,
  fallback: string,
): TrainingPlanImprovementClientError {
  const kind = status === 404 ? 'not_found' : status === 409 ? 'conflict' : 'generic';
  return new TrainingPlanImprovementClientError(kind, getApiMessage(body) ?? fallback);
}

function getApiMessage(value: unknown): string | null {
  return isRecord(value) && typeof value.message === 'string' && value.message.trim()
    ? value.message
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
