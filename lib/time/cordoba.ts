/**
 * Canonical product timezone (ADR-001 / AGENTS.md).
 * Argentina does not observe DST; Córdoba is UTC−3 year-round.
 */
export const CORDOBA_TIMEZONE = 'America/Argentina/Cordoba';

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Returns the calendar date (YYYY-MM-DD) for `instant` in Córdoba.
 */
export function cordobaLocalDate(instant: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CORDOBA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/**
 * Adds `days` (may be negative) to a YYYY-MM-DD calendar date without TZ shift.
 */
export function addLocalDateDays(localDate: string, days: number): string {
  if (!LOCAL_DATE_RE.test(localDate)) {
    throw new Error(`Invalid local date: ${localDate}`);
  }
  const [year, month, day] = localDate.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  const yyyy = String(utc.getUTCFullYear()).padStart(4, '0');
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Yesterday's calendar date in Córdoba relative to `instant`.
 */
export function yesterdayCordoba(instant: Date = new Date()): string {
  return addLocalDateDays(cordobaLocalDate(instant), -1);
}

/**
 * Human display date in Córdoba (es-AR), e.g. "jueves, 24 de septiembre".
 */
export function cordobaDisplayDate(instant: Date = new Date()): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: CORDOBA_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(instant);
}

/**
 * Monday-first weekday index (0 = Monday … 6 = Sunday) for a YYYY-MM-DD calendar
 * date, computed purely from the calendar day with no timezone shift.
 * @param localDate Córdoba calendar date (YYYY-MM-DD).
 * @returns Monday-based weekday index in the range 0–6.
 * @example localDateWeekdayIndex('2026-09-24') // 3 (Thursday)
 */
export function localDateWeekdayIndex(localDate: string): number {
  if (!LOCAL_DATE_RE.test(localDate)) {
    throw new Error(`Invalid local date: ${localDate}`);
  }
  const [year, month, day] = localDate.split('-').map(Number);
  const sundayFirst = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (sundayFirst + 6) % 7;
}

const WEEKDAY_TO_MONDAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

/**
 * Weekday index for `instant` in Córdoba, Monday-first (0 = Monday … 6 = Sunday).
 * @param instant Point in time to evaluate (defaults to now).
 * @returns Monday-based weekday index in the range 0–6.
 * @example cordobaWeekdayIndex(new Date('2026-09-24T12:00:00Z')) // 3 (Thursday)
 */
export function cordobaWeekdayIndex(instant: Date = new Date()): number {
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: CORDOBA_TIMEZONE,
    weekday: 'short',
  }).format(instant);
  return WEEKDAY_TO_MONDAY_INDEX[short] ?? 0;
}
