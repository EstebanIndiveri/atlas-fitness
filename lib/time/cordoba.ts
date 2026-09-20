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
