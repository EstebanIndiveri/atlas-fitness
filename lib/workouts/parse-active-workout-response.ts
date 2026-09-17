import type { Workout } from '@/lib/db/schema';

/**
 * GET /api/workouts/active contract:
 * - 200 + workout JSON when an active session exists
 * - 200 + `null` when there is no active workout (not HTTP 404)
 * - 401 `{ code: 'UNAUTHORIZED', message }` when unauthenticated
 */
export type ActiveWorkoutApiBody = Workout | null;

/**
 * Maps the active-workout HTTP response to UI state.
 * A JSON `null` body means no active session. Non-OK (including legacy 404) is also no active.
 */
export function parseActiveWorkoutResponse(
  responseOk: boolean,
  body: unknown,
): Workout | null {
  if (!responseOk || body === null) {
    return null;
  }

  if (typeof body !== 'object') {
    return null;
  }

  if (!('id' in body) || typeof body.id !== 'number') {
    return null;
  }

  return body as Workout;
}
