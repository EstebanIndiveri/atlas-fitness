import { SESSION_COPY } from '@/lib/copy/session';
import {
  mapSessionQueueHttpError,
  parseWorkoutQueueActionResponse,
  SessionQueueClientError,
} from '@/lib/session/parse-action';
import type { SessionQueueAction, WorkoutQueueActionResponse } from '@/types/session-queue';

export { SessionQueueClientError };

export function createClientMutationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `mut-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function postWorkoutQueueAction(args: {
  workoutId: number;
  action: SessionQueueAction;
  exerciseId: number;
  clientMutationId: string;
}): Promise<WorkoutQueueActionResponse> {
  const response = await fetch(`/api/workouts/${args.workoutId}/${args.action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      exerciseId: args.exerciseId,
      clientMutationId: args.clientMutationId,
    }),
  });

  const body = await readBody(response);
  if (!response.ok) {
    throw mapSessionQueueHttpError(response.status, body);
  }

  const parsed = parseWorkoutQueueActionResponse(body);
  if (!parsed || parsed.action !== args.action) {
    throw new SessionQueueClientError('generic', SESSION_COPY.errorQueueAction, response.status);
  }

  return parsed;
}

async function readBody(response: Response): Promise<unknown> {
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
