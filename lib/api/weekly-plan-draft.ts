import type { WeeklyPlanDraft } from '@/lib/ai/weekly-plan-draft';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Checks that a server response is safe to display and submit for persistence.
 *
 * @param value Untrusted JSON returned by the weekly-draft API.
 * @returns True only for a bounded draft with distinct weekdays and valid targets.
 * @example
 * if (isWeeklyPlanDraft(body)) setDraft(body);
 */
export function isWeeklyPlanDraft(value: unknown): value is WeeklyPlanDraft {
  if (
    !isRecord(value)
    || (value.source !== 'gemini' && value.source !== 'fallback')
    || typeof value.name !== 'string'
    || typeof value.goal !== 'string'
    || !Array.isArray(value.days)
    || value.days.length < 1
    || value.days.length > 7
  ) {
    return false;
  }

  const weekdays = new Set<number>();
  for (const day of value.days) {
    if (
      !isRecord(day)
      || typeof day.dayOfWeek !== 'number'
      || !Number.isInteger(day.dayOfWeek)
      || day.dayOfWeek < 0
      || day.dayOfWeek > 6
      || weekdays.has(day.dayOfWeek)
      || typeof day.title !== 'string'
      || typeof day.focus !== 'string'
      || !Array.isArray(day.exercises)
      || day.exercises.length === 0
    ) {
      return false;
    }
    weekdays.add(day.dayOfWeek);

    for (const exercise of day.exercises) {
      if (
        !isRecord(exercise)
        || typeof exercise.exerciseId !== 'number'
        || !Number.isInteger(exercise.exerciseId)
        || exercise.exerciseId < 1
        || typeof exercise.exerciseName !== 'string'
        || typeof exercise.muscleGroup !== 'string'
        || typeof exercise.sortOrder !== 'number'
        || !Number.isInteger(exercise.sortOrder)
        || exercise.sortOrder < 0
        || typeof exercise.targetSets !== 'number'
        || !Number.isInteger(exercise.targetSets)
        || exercise.targetSets < 1
        || exercise.targetSets > 8
        || typeof exercise.targetReps !== 'number'
        || !Number.isInteger(exercise.targetReps)
        || exercise.targetReps < 1
        || exercise.targetReps > 30
      ) {
        return false;
      }
    }
  }

  return true;
}
