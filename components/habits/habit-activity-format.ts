import { CORDOBA_TIMEZONE } from '@/lib/time/cordoba';

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const DAY_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  timeZone: CORDOBA_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  timeZone: CORDOBA_TIMEZONE,
  weekday: 'short',
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

/**
 * Initial of the Córdoba weekday of a local date, Monday-first.
 *
 * Rendered next to each day mark in the habits activity record. The initial is not
 * unique in es-AR (`mar` and `mié` both start with `M`), so it only ever accompanies
 * the full accessible day label.
 *
 * @param localDate Date in `YYYY-MM-DD` format, as returned by the habit-activity service.
 * @returns A single uppercase initial, or an empty string when the value is not a date-only value.
 * @example
 * formatHabitActivityWeekday('2026-09-21'); // "L"
 * formatHabitActivityWeekday('nope'); // ""
 */
export function formatHabitActivityWeekday(localDate: string): string {
  if (!LOCAL_DATE_PATTERN.test(localDate)) {
    return '';
  }
  const initial = WEEKDAY_FORMATTER.format(new Date(`${localDate}T12:00:00.000-03:00`)).charAt(0);
  return initial.toUpperCase();
}
