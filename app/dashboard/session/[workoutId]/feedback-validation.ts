import {
  POST_WORKOUT_FEEDBACK_DISCOMFORT_MAX_ENTRIES,
  POST_WORKOUT_FEEDBACK_NOTE_MAX_LENGTH,
} from '@/components/session/PostWorkoutFeedbackForm';
import type {
  DiscomfortEntry,
  WorkoutSensation,
} from '@/lib/services/post-workout-feedback';

/**
 * Validates controlled post-workout feedback before the UI posts to the API.
 *
 * @param effort User-selected perceived effort.
 * @param sensation User-selected workout sensation.
 * @param discomfort Optional discomfort entries.
 * @param note Optional note text.
 * @returns True when the payload satisfies the API's client-side constraints.
 * @example
 * isValidFeedback(8, 'good', [], 'Terminó sólido');
 */
export function isValidFeedback(
  effort: number | null,
  sensation: WorkoutSensation | null,
  discomfort: DiscomfortEntry[],
  note: string,
): effort is number {
  return (
    typeof effort === 'number' &&
    Number.isInteger(effort) &&
    effort >= 1 &&
    effort <= 10 &&
    sensation !== null &&
    isValidDiscomfortEntries(discomfort) &&
    note.length <= POST_WORKOUT_FEEDBACK_NOTE_MAX_LENGTH
  );
}

function isValidDiscomfortEntries(discomfort: DiscomfortEntry[]): boolean {
  return (
    discomfort.length <= POST_WORKOUT_FEEDBACK_DISCOMFORT_MAX_ENTRIES &&
    discomfort.every((entry) => isValidDiscomfortArea(entry.area) && isValidDiscomfortIntensity(entry.intensity))
  );
}

function isValidDiscomfortArea(value: DiscomfortEntry['area']): boolean {
  return (
    value === 'neck' ||
    value === 'shoulder' ||
    value === 'elbow' ||
    value === 'wrist' ||
    value === 'back' ||
    value === 'hip' ||
    value === 'knee' ||
    value === 'ankle' ||
    value === 'other'
  );
}

function isValidDiscomfortIntensity(value: DiscomfortEntry['intensity']): boolean {
  return value === 'mild' || value === 'moderate' || value === 'strong';
}
