import { parseApiErrorBody } from '@/lib/routines/parse-error';
import type {
  CreateTrainingPlanResult,
  TrainingPlanDayOfWeek,
} from '@/lib/services/training-plan';
import type { ScheduledRoutine, TrainingPlan } from '@/lib/db/schema';
import type { ApiError } from '@/types/errors';

export type CreateTrainingPlanInput = {
  name: string;
  goal?: string;
  schedule: Array<{ dayOfWeek: TrainingPlanDayOfWeek; routineId: number; note?: string }>;
  mutationId?: string;
  replacePlanId?: number;
  replacePlanUpdatedAt?: string;
  replacePlanStateHash?: string;
};

export type UpdateTrainingPlanInput = CreateTrainingPlanInput;

export type TrainingPlanClientErrorKind =
  | 'unauthorized'
  | 'validation'
  | 'not_found'
  | 'generic';

export class TrainingPlanClientError extends Error {
  constructor(
    public kind: TrainingPlanClientErrorKind,
    message: string,
    public status: number,
    public api: ApiError | null = null,
  ) {
    super(message);
    this.name = 'TrainingPlanClientError';
  }
}

/**
 * Creates the authenticated user's weekly training plan.
 *
 * @param input - Plan name and day-to-routine assignments using 0=Sunday through 6=Saturday.
 * @returns The created training plan and persisted schedule.
 * @throws {TrainingPlanClientError} When the API rejects the request or returns an invalid body.
 * @example
 * const result = await createTrainingPlan({
 *   name: 'Semana base',
 *   schedule: [{ dayOfWeek: 1, routineId: 7 }],
 * });
 */
export async function createTrainingPlan(
  input: CreateTrainingPlanInput,
): Promise<CreateTrainingPlanResult> {
  const response = await fetch('/api/training-plan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await readBody(response);

  if (!response.ok) {
    throw mapTrainingPlanHttpError(response.status, body);
  }

  const parsed = parseTrainingPlanResponse(body);
  if (!parsed) {
    throw new TrainingPlanClientError(
      'generic',
      'No se pudo crear el plan de entrenamiento',
      response.status,
    );
  }

  return parsed;
}

/**
 * Fetches one authenticated user's training plan by id.
 *
 * @param planId - Training plan id to load.
 * @returns The requested training plan and persisted schedule.
 * @throws {TrainingPlanClientError} When the API rejects the request or returns an invalid body.
 * @example
 * const plan = await getTrainingPlan(10);
 */
export async function getTrainingPlan(planId: number): Promise<CreateTrainingPlanResult> {
  const response = await fetch(`/api/training-plan/${planId}`);
  const body = await readBody(response);

  if (!response.ok) {
    throw mapTrainingPlanHttpError(response.status, body);
  }

  const parsed = parseTrainingPlanResponse(body);
  if (!parsed) {
    throw new TrainingPlanClientError(
      'generic',
      'No se pudo cargar el plan de entrenamiento',
      response.status,
    );
  }

  return parsed;
}

/**
 * Fetches the authenticated user's active plan, if any.
 *
 * @returns The active plan and its schedule, or null when none exists.
 * @throws {TrainingPlanClientError} When the API rejects the request or returns an invalid body.
 */
export async function getActiveTrainingPlan(): Promise<CreateTrainingPlanResult | null> {
  const response = await fetch('/api/training-plan/active');
  const body = await readBody(response);
  if (!response.ok) {
    throw mapTrainingPlanHttpError(response.status, body);
  }
  if (body === null) {
    return null;
  }
  const parsed = parseTrainingPlanResponse(body);
  if (!parsed) {
    throw new TrainingPlanClientError(
      'generic',
      'No se pudo cargar el plan de entrenamiento',
      response.status,
    );
  }
  return parsed;
}

/**
 * Archives an active plan using an owner-scoped idempotency key and expected version.
 *
 * @param planId - Persisted plan id to archive.
 * @param input - Confirmation mutation id and last-seen update timestamp.
 * @returns The archived plan and preserved schedule.
 * @throws {TrainingPlanClientError} When the API rejects the request or returns an invalid body.
 */
export async function archiveTrainingPlan(
  planId: number,
  input: { mutationId: string; expectedPlanUpdatedAt: string },
): Promise<CreateTrainingPlanResult> {
  const response = await fetch(`/api/training-plan/${planId}/archive`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await readBody(response);
  if (!response.ok) {
    throw mapTrainingPlanHttpError(response.status, body);
  }
  const parsed = parseTrainingPlanResponse(body);
  if (!parsed) {
    throw new TrainingPlanClientError(
      'generic',
      'No se pudo archivar el plan de entrenamiento',
      response.status,
    );
  }
  return parsed;
}

/**
 * Updates one authenticated user's training plan.
 *
 * @param planId - Training plan id to update.
 * @param input - Plan name and day-to-routine assignments using 0=Sunday through 6=Saturday.
 * @returns The updated training plan and persisted replacement schedule.
 * @throws {TrainingPlanClientError} When the API rejects the request or returns an invalid body.
 * @example
 * await updateTrainingPlan(10, { name: 'Semana', schedule: [{ dayOfWeek: 1, routineId: 7 }] });
 */
export async function updateTrainingPlan(
  planId: number,
  input: UpdateTrainingPlanInput,
): Promise<CreateTrainingPlanResult> {
  const response = await fetch(`/api/training-plan/${planId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await readBody(response);

  if (!response.ok) {
    throw mapTrainingPlanHttpError(response.status, body);
  }

  const parsed = parseTrainingPlanResponse(body);
  if (!parsed) {
    throw new TrainingPlanClientError(
      'generic',
      'No se pudo guardar el plan de entrenamiento',
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

function mapTrainingPlanHttpError(status: number, body: unknown): TrainingPlanClientError {
  const api = parseApiErrorBody(body);

  if (status === 401 || api?.code === 'UNAUTHORIZED') {
    return new TrainingPlanClientError(
      'unauthorized',
      api?.message || 'Autenticación requerida',
      status,
      api,
    );
  }

  if (status === 400 || api?.code === 'VALIDATION') {
    return new TrainingPlanClientError(
      'validation',
      api?.message || 'Plan inválido',
      status,
      api,
    );
  }

  if (status === 404 || api?.code === 'NOT_FOUND') {
    return new TrainingPlanClientError(
      'not_found',
      api?.message || 'Plan no encontrado',
      status,
      api,
    );
  }

  return new TrainingPlanClientError(
    'generic',
    api?.message || 'No se pudo crear el plan de entrenamiento',
    status,
    api,
  );
}

function parseTrainingPlanResponse(value: unknown): CreateTrainingPlanResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const plan = parseTrainingPlan(value.plan);
  if (!plan || !Array.isArray(value.schedule)) {
    return null;
  }

  const schedule: ScheduledRoutine[] = [];
  for (const item of value.schedule) {
    const scheduled = parseScheduledRoutine(item);
    if (!scheduled) {
      return null;
    }
    schedule.push(scheduled);
  }

  if (
    value.replacementStateHash !== undefined
    && (typeof value.replacementStateHash !== 'string'
      || !/^[0-9a-f]{64}$/.test(value.replacementStateHash))
  ) {
    return null;
  }
  return {
    plan,
    schedule,
    ...(typeof value.replacementStateHash === 'string'
      ? { replacementStateHash: value.replacementStateHash }
      : {}),
  };
}

function parseTrainingPlan(value: unknown): TrainingPlan | null {
  if (!isRecord(value)) {
    return null;
  }

  const createdAt = parseDate(value.createdAt);
  const updatedAt = parseDate(value.updatedAt);
  const deletedAt = parseNullableDate(value.deletedAt);

  if (
    !isInteger(value.id) ||
    !isInteger(value.userId) ||
    typeof value.name !== 'string' ||
    typeof value.isActive !== 'boolean' ||
    !createdAt ||
    !updatedAt ||
    deletedAt === undefined
  ) {
    return null;
  }

  return {
    id: value.id,
    userId: value.userId,
    name: value.name,
    goal: typeof value.goal === 'string' ? value.goal : null,
    isActive: value.isActive,
    createdAt,
    updatedAt,
    deletedAt,
  };
}

function parseScheduledRoutine(value: unknown): ScheduledRoutine | null {
  if (!isRecord(value)) {
    return null;
  }

  const createdAt = parseDate(value.createdAt);

  if (
    !isInteger(value.id) ||
    !isInteger(value.trainingPlanId) ||
    !isDayOfWeek(value.dayOfWeek) ||
    !isInteger(value.routineId) ||
    !createdAt
  ) {
    return null;
  }

  return {
    id: value.id,
    trainingPlanId: value.trainingPlanId,
    dayOfWeek: value.dayOfWeek,
    routineId: value.routineId,
    note: typeof value.note === 'string' ? value.note : null,
    createdAt,
  };
}

function parseDate(value: unknown): Date | null | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseNullableDate(value: unknown): Date | null | undefined {
  if (value === null) {
    return null;
  }

  return parseDate(value) ?? undefined;
}

function isDayOfWeek(value: unknown): value is TrainingPlanDayOfWeek {
  return isInteger(value) && value >= 0 && value <= 6;
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
