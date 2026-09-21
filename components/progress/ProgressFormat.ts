import { CORDOBA_TIMEZONE } from '@/lib/time/cordoba';

const MONTH_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  timeZone: CORDOBA_TIMEZONE,
  month: 'long',
  year: 'numeric',
});

const SESSION_DATE_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  timeZone: CORDOBA_TIMEZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/**
 * Formats minutes as a compact hours/minutes label.
 *
 * @param minutes Total duration in minutes.
 * @returns Human-readable duration.
 * @example
 * formatDurationMinutes(95) // "1h 35m"
 */
export function formatDurationMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, minutes);
  const hours = Math.floor(safeMinutes / 60);
  const remaining = safeMinutes % 60;
  if (hours === 0) {
    return `${remaining}m`;
  }
  if (remaining === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remaining}m`;
}

/**
 * Formats a Córdoba local month label from a summary date or current date.
 *
 * @param localDate Date in `YYYY-MM-DD` format, or null when unavailable.
 * @param now Fallback clock instant.
 * @returns Month/year label in es-AR.
 * @example
 * formatProgressMonth('2026-09-30', new Date()) // "septiembre de 2026"
 */
export function formatProgressMonth(localDate: string | null, now: Date = new Date()): string {
  if (localDate) {
    return MONTH_FORMATTER.format(new Date(`${localDate}T12:00:00.000-03:00`));
  }
  return MONTH_FORMATTER.format(now);
}

/**
 * Formats a session timestamp for the Progreso recent sessions list.
 *
 * @param startedAt ISO timestamp persisted on the workout.
 * @returns Date label in es-AR.
 * @example
 * formatSessionDate('2026-09-24T12:00:00.000Z') // "24 de sept de 2026"
 */
export function formatSessionDate(startedAt: string): string {
  return SESSION_DATE_FORMATTER.format(new Date(startedAt));
}

/**
 * Computes the weekly active-day percentage from real active days.
 *
 * @param activeCount Number of active days in a seven-day week.
 * @returns Rounded percentage clamped to 0..100.
 * @example
 * formatWeekConsistencyPercent(4) // 57
 */
export function formatWeekConsistencyPercent(activeCount: number): number {
  return Math.min(100, Math.max(0, Math.round((activeCount / 7) * 100)));
}
