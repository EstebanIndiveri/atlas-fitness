/**
 * Product-visible cleanup helpers.
 *
 * A repeated DELETE returns 404. That is accepted only after a readback proves
 * the artifact is absent from the visible list; otherwise cleanup fails rather
 * than guessing.
 */
export type CleanupOutcome = 'deleted' | 'absent';

export interface DeleteWithReadbackInput {
  workoutId: number;
  /** Issues the soft delete; resolves with the HTTP status. */
  deleteWorkout: () => Promise<number>;
  /** Reads the current visible workout ids for the QA identity. */
  listWorkoutIds: () => Promise<readonly number[]>;
}

export async function deleteWorkoutWithReadback(
  input: DeleteWithReadbackInput,
): Promise<CleanupOutcome> {
  const status = await input.deleteWorkout();
  if (status === 200) {
    return 'deleted';
  }
  if (status === 404) {
    const visibleIds = await input.listWorkoutIds();
    if (!visibleIds.includes(input.workoutId)) {
      return 'absent';
    }
    throw new Error(`Workout ${input.workoutId} still visible after a 404 delete`);
  }
  throw new Error(`Unexpected delete status ${status} for workout ${input.workoutId}`);
}
