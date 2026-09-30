import { parseExerciseContext, requireJson } from './api-ops';
import { requireHttpStatus } from './http-status';
import { SmokeStop } from './smoke-stop';
import type { HttpResult } from './types';

/**
 * Product-visible cleanup helpers.
 *
 * A repeated DELETE returns 404. That is accepted only after a readback proves
 * the artifact is absent from the visible list; a deleted note is accepted only
 * after a readback proves `currentNote:null`. `429` always maps to INCOMPLETE
 * through `requireHttpStatus`.
 */
export type CleanupOutcome = 'deleted' | 'absent';

export interface DeleteWithReadbackInput {
  workoutId: number;
  /** Issues the soft delete; resolves with the full response (for headers). */
  deleteWorkout: () => Promise<HttpResult>;
  /** Reads the current visible workout ids for the QA identity. */
  listWorkoutIds: () => Promise<readonly number[]>;
}

export async function deleteWorkoutWithReadback(
  input: DeleteWithReadbackInput,
): Promise<CleanupOutcome> {
  const result = await input.deleteWorkout();
  requireHttpStatus(result, [200, 404], 'cleanup', `delete_workout_${input.workoutId}`);
  if (result.status === 200) {
    return 'deleted';
  }
  const visibleIds = await input.listWorkoutIds();
  if (!visibleIds.includes(input.workoutId)) {
    return 'absent';
  }
  throw new SmokeStop(
    'cleanup',
    'FAIL',
    `workout_${input.workoutId}_still_visible_after_404`,
  );
}

/**
 * Note-removal outcome. `unreachable` is the explicit documented acceptance for
 * a note whose workout is already closed/soft-deleted (architecture §4 step 8):
 * it is no longer reachable through normal context, so it cannot be deleted.
 */
export type NoteCleanupOutcome = 'deleted' | 'unreachable';

export interface DeleteNoteWithReadbackInput {
  deleteNote: () => Promise<HttpResult>;
  readContext: () => Promise<HttpResult>;
}

/**
 * Deletes the smoke note and asserts `currentNote:null` on readback (§4 step 8).
 *
 * A refused delete (400/409) is tolerated **only** when the readback proves the
 * context is unreachable (404). A retained, reachable note is always a FAIL.
 */
export async function deleteNoteWithReadback(
  input: DeleteNoteWithReadbackInput,
): Promise<NoteCleanupOutcome> {
  const removal = await input.deleteNote();
  requireHttpStatus(removal, [200, 400, 404, 409], 'cleanup', 'delete_note');

  const readback = await input.readContext();
  if (readback.status === 404) {
    return 'unreachable';
  }
  requireHttpStatus(readback, [200], 'cleanup', 'context_after_note_delete');
  const context = parseExerciseContext(requireJson(readback, 'context'), 'context');
  if (context.currentNote !== null) {
    throw new SmokeStop('cleanup', 'FAIL', 'note_still_reachable_after_delete');
  }
  return 'deleted';
}
