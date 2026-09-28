import { CORDOBA_TIMEZONE } from '@/lib/time/cordoba';

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const DAY_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  timeZone: CORDOBA_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/**
 * Formats a Córdoba local date for the habit-activity window caption.
 *
 * The date-only value is anchored at noon Córdoba so the rendered day never
 * shifts for a reader in another timezone — the same idiom the progress
 * formatters use.
 *
 * @param localDate Date in `YYYY-MM-DD` format, as returned by the habit-activity service.
 * @returns Day-first es-AR label, or an empty string when the value is not a date-only value.
 * @example
 * formatHabitActivityDate('2026-09-21'); // "21/09/2026"
 * formatHabitActivityDate(''); // ""
 */
export function formatHabitActivityDate(localDate: string): string {
  if (!LOCAL_DATE_PATTERN.test(localDate)) {
    return '';
  }
  return DAY_FORMATTER.format(new Date(`${localDate}T12:00:00.000-03:00`));
}
