import { expect, test, type Locator, type Page } from '@playwright/test';

import { registerAndCompleteTestAccount } from './helpers/auth';
import { expectNoHorizontalOverflow } from './helpers/viewport';
import type { AuthUser } from '../types/auth';
import type { HabitActivityPeriod, HabitActivityWindow } from '../types/habit-activity';
import type { HabitKey } from '../types/habit';
import type { WeekConsistency } from '../types/week';

/**
 * E2E coverage for the habit-activity readback shipped in v0.9.0 (WS A/B/C).
 *
 * Only the production read path is exercised end to end:
 * `GET /api/stats/habits` → `useHabitActivity` → `HabitActivityCard` (progress page)
 * and `HabitActivityHistory` (habits page). Nothing is stubbed or mocked.
 *
 * Day-agnostic by contract. The current Córdoba week starts on Monday and ends six
 * days later, so the week window can end in the future and its elapsed-day count
 * changes with the weekday. No test hardcodes a weekday, "today", or a fixed
 * denominator: the expected window, elapsed days, recorded days, per-habit counts
 * and insight status are recomputed on every run, and the assertions compare the
 * running UI against the response the running API just produced.
 *
 * Fixtures. Every test registers a brand-new account through the real `/register`
 * form, so pre-existing data can never leak into an assertion. Multi-day history is
 * written straight into `habit_logs` for that throwaway account because the product
 * exposes no API to record a past day (`POST /api/habits` only ever writes today).
 * That insert is fixture setup, not the subject under test: the activity under test
 * is always read back through the app.
 */

const HABIT_KEY_NAMES: Record<HabitKey, string> = {
  hydration: 'Hidratación',
  walk: 'Pasos Activos',
  mobility: 'Movilidad',
  sleep: 'Descanso & Sueño',
};

/** Every habit key, in the order the product lists them. */
const HABIT_KEYS: readonly HabitKey[] = ['hydration', 'walk', 'mobility', 'sleep'];

const CARD_TITLE = 'Actividad de hábitos registrada';
const HISTORY_TITLE = 'Registro de actividad de hábitos';
/** Accessible name of the progress-page period control. */
const PROGRESS_PERIOD_GROUP_NAME = 'Rango de progreso';
/** Accessible name of the habit-activity history period control. */
const ACTIVITY_PERIOD_GROUP_NAME = 'Período de actividad de hábitos';
const PERIOD_LABELS: Record<HabitActivityPeriod, string> = {
  week: 'Semana',
  month: 'Mes',
  quarter: '3 meses',
};
const INSIGHT_MINIMUM_ELAPSED_DAYS = 7;
const DAYS_PER_PERIOD: Record<HabitActivityPeriod, number> = { week: 7, month: 30, quarter: 90 };
const TIMEZONE_SUFFIX = '(hora de Córdoba)';
const DAY_RECORDED_SUFFIX = ': registrado';
const DAY_MISSING_SUFFIX = ': sin registro';
const DAY_FUTURE_SUFFIX = ': todavía no llegó';
const FORBIDDEN_METRIC_READINGS = ['-', '—', 'Sin datos', 'N/D', 'NaN', 'null', 'undefined'] as const;

/** Copy that must never describe habit activity: goals, adherence and scorekeeping language. */
const FORBIDDEN_ACTIVITY_VOCABULARY =
  /adherencia|cumplimiento|\bmeta\b|\bmetas\b|objetivo|porcentaje|%|\bracha\b|\brachas\b|logro|nivel|puntos|puntaje|score/i;

/**
 * Database the fixture rows are written to.
 *
 * Mirrors `playwright.config.ts:43`, which starts the app under test with the same
 * expression, so the spec can only ever seed the database the running app reads.
 */
const FIXTURE_DATABASE_URL = process.env.TURSO_DATABASE_URL || 'file:./local.db';

const HABIT_TOTAL = 4;
const ACTIVE_DAYS_LABEL = 'Días con hábitos registrados';
const ELAPSED_DAYS_LABEL = 'Días transcurridos del período';
const INSUFFICIENT_TITLE = 'Todavía no hay suficiente período para resumir';
const INSUFFICIENT_NO_ACTIVITY = 'Todavía no registraste ningún hábito en este período.';
const PROVENANCE_LABEL = 'Calculado por Atlas';
const WEEK_STRIP_NAME = 'Días de la semana';
const WELLBEING_TITLE = 'Bienestar registrado';
const WELLBEING_WINDOW_LABEL =
  'Refleja solo tu check-in de hoy. No se acumula con el período elegido.';

/** `HABIT_COPY.completed` as both habit hosts render it. */
function completedLabel(done: number, total: number): string {
  return `${done} de ${total} completados`;
}

/** `PROGRESS_COPY.habits.todayOnly` as the habits page renders it. */
function todayOnlySentence(done: number, total: number): string {
  return `Hoy registraste ${done} de ${total} hábitos. Abajo está el detalle día por día del período elegido.`;
}

/** `habitActivity.summary`, the only sentence that reports recorded days of the period. */
function summarySentence(activeDays: number, elapsedDays: number): string {
  return `Registraste hábitos en ${activeDays} de los ${elapsedDays} días transcurridos.`;
}

/** `habitActivity.windowLabel`, the caption both habit-activity surfaces render. */
function windowCaption(from: string, to: string): string {
  return `Del ${from} al ${to} ${TIMEZONE_SUFFIX}`;
}

/** `habitActivity.insufficientElapsed`, shown while the period is shorter than the minimum. */
function insufficientElapsedSentence(elapsedDays: number, minimumElapsedDays: number): string {
  return `Pasaron ${elapsedDays} de los ${minimumElapsedDays} días que Atlas necesita para resumir este período.`;
}

/** `habitActivity.recordedDaysLabel`, the per-habit line of the history strips. */
function recordedDaysLabel(habitName: string, activeDays: number, elapsedDays: number): string {
  return `${habitName}: ${activeDays} de ${elapsedDays} días con registro`;
}

interface SeedRow {
  readonly localDate: string;
  readonly habitKey: HabitKey;
}

interface DayMarks {
  readonly total: number;
  readonly recorded: number;
  readonly missing: number;
  readonly future: number;
  readonly labels: readonly string[];
}

/** Córdoba local calendar date (`YYYY-MM-DD`) for an instant, defaulting to now. */
function cordobaLocalDateOf(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Cordoba',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** Shifts a `YYYY-MM-DD` date by whole days on the proleptic Gregorian calendar. */
function shiftLocalDate(localDate: string, days: number): string {
  const [year, month, day] = localDate.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day));
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` rendered the way the product shows it: `DD/MM/YYYY`. */
function displayDate(localDate: string): string {
  const [year, month, day] = localDate.split('-');
  return `${day}/${month}/${year}`;
}

/** Monday-first weekday names the week strip renders as accessible names. */
const WEEK_DAY_NAMES = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
] as const;

/** Monday-first weekday index (0–6) for a `YYYY-MM-DD` date. */
function weekdayIndex(localDate: string): number {
  const [year, month, day] = localDate.split('-').map(Number);
  const sundayFirst = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (sundayFirst + 6) % 7;
}

/**
 * Independently re-derives the window the service must return for a period, using
 * only the Córdoba calendar: `week` is the current Monday-to-Sunday week (its end may
 * still be in the future), `month` is the trailing 30 days, `quarter` the trailing 90.
 */
function expectedWindowFor(period: HabitActivityPeriod, today: string): { start: string; end: string } {
  if (period === 'week') {
    const start = shiftLocalDate(today, -weekdayIndex(today));
    return { start, end: shiftLocalDate(start, DAYS_PER_PERIOD.week - 1) };
  }
  return { start: shiftLocalDate(today, -(DAYS_PER_PERIOD[period] - 1)), end: today };
}

interface SessionIdentity {
  readonly id: number;
  readonly email: string;
}

/** Password the shared registration helper uses; the logout/login round trip reuses it. */
const TEST_PASSWORD = 'Test1234!';

/**
 * Reads the signed-in account from the session-protected profile API.
 *
 * `/api/auth/me` derives both values from the session cookie, so the id is the one the server
 * resolved for this account: fixture rows keyed by it can only ever be visible to this account.
 * The email is the address `registerAndCompleteTestAccount` generates internally, which the
 * logout/login round trip needs and which the registration response never exposes.
 */
async function readSessionIdentity(page: Page): Promise<SessionIdentity> {
  const meResponse = await page.request.get('/api/auth/me');
  expect(meResponse.status(), 'GET /api/auth/me should succeed for a signed-in user').toBe(200);
  const currentUser = (await meResponse.json()) as AuthUser;
  expect(typeof currentUser.id, 'the session user must expose a numeric id').toBe('number');
  expect(typeof currentUser.email, 'the session user must expose an email').toBe('string');
  return { id: currentUser.id, email: currentUser.email };
}

/** Signs the current session out through the real navigation control. */
async function logout(page: Page): Promise<void> {
  await Promise.all([
    page.waitForURL('/login', { timeout: 15000 }),
    page.getByRole('button', { name: 'Cerrar sesión' }).click(),
  ]);
}

/**
 * Signs back in through the real login form, so the data read afterwards can only come from the
 * server-side session rather than from anything the previous page kept in memory.
 */
async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await Promise.all([
    page.waitForURL('/dashboard/today', { timeout: 15000 }),
    page.getByRole('button', { name: 'Ingresar' }).click(),
  ]);
  await expect(page.getByTestId('welcome-message')).toBeVisible({ timeout: 15000 });
}

/**
 * Registers a fresh account through the real `/register` flow, completes onboarding and returns
 * its identity, so no assertion can ever be satisfied by another test's data.
 */
async function registerFreshUser(page: Page): Promise<SessionIdentity> {
  await registerAndCompleteTestAccount(page, 'Actividad Habitos');
  return readSessionIdentity(page);
}

/**
 * Refuses any fixture database that is not the local file database the app under test was
 * started against.
 *
 * Two-part guard, mirroring `jest.setup.ts:5-9` (missing URL first, then an explicit check),
 * because `lib/db/database-url.ts` only re-checks unsafe test URLs under Jest and Playwright is
 * not Jest (`JEST_WORKER_ID` is never set). Its `isUnsafeTestDatabaseUrl` helper cannot be reused
 * here: it reports `true` for anything containing `local.db` (the exact database E2E fixtures must
 * seed), so it is a Jest-only rejection list. This positive allow-list inverts that intent: the
 * database must be a `file:` SQLite path named `local.db`, so a remote or missing URL can never
 * receive fixture rows.
 */
function assertLocalFixtureDatabase(url: string | undefined): void {
  const trimmed = url?.trim() ?? '';
  const path = trimmed.split('?')[0];
  const isRemote = /^(libsql|https?|wss?):\/\//i.test(trimmed);
  const isLocalFileDatabase = trimmed.startsWith('file:') && path.endsWith('local.db');
  if (!isLocalFileDatabase || isRemote) {
    throw new Error(`Refusing to seed a non-local database: ${url}`);
  }
}

/** Opens the throwaway file database that the app under test reads. */
async function connectFixtureDatabase() {
  assertLocalFixtureDatabase(FIXTURE_DATABASE_URL);
  const { createClient } = await import('@libsql/client');
  const database = createClient({
    url: FIXTURE_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });
  // The app serves from this same file, so a write that overlaps a request would otherwise be
  // rejected with SQLITE_BUSY instead of waiting its turn.
  await database.execute('PRAGMA busy_timeout = 5000');
  return database;
}

type FixtureDatabase = Awaited<ReturnType<typeof connectFixtureDatabase>>;

/** Runs one fixture statement set against the local database and always closes it. */
async function withFixtureDatabase(
  run: (database: FixtureDatabase) => Promise<void>
): Promise<void> {
  const database = await connectFixtureDatabase();
  try {
    await run(database);
  } finally {
    database.close();
  }
}

/** Account ids this worker seeded, so `afterAll` can delete exactly its own rows. */
const seededUserIds = new Set<number>();

/**
 * Writes past habit activity for one throwaway account.
 *
 * The product exposes no API to record a past day (`POST /api/habits` only writes today),
 * so a multi-day window can only be prepared through the fixture database. Duplicate
 * `(date, habit)` pairs are collapsed first: `habit_logs` is uniquely indexed on
 * `(user_id, local_date, habit_key)`, so the plain INSERT below must never see a repeated
 * pair — if it ever did, the conflict would surface the fixture bug loudly.
 */
async function seedHabitLogs(userId: number, rows: readonly SeedRow[]): Promise<void> {
  const uniqueRows = new Map<string, SeedRow>();
  for (const row of rows) {
    uniqueRows.set(`${row.localDate}|${row.habitKey}`, row);
  }
  await withFixtureDatabase(async (database) => {
    await database.batch(
      [...uniqueRows.values()].map((row) => ({
        sql: 'INSERT INTO habit_logs (user_id, local_date, habit_key, done) VALUES (?, ?, ?, 1)',
        args: [userId, row.localDate, row.habitKey],
      })),
      'write'
    );
  });
  seededUserIds.add(userId);
}

/** Deletes every fixture row written for the given accounts. */
async function deleteSeededHabitLogs(userIds: readonly number[]): Promise<void> {
  if (userIds.length === 0) {
    return;
  }
  await withFixtureDatabase(async (database) => {
    for (const userId of userIds) {
      await database.execute({
        sql: 'DELETE FROM habit_logs WHERE user_id = ?',
        args: [userId],
      });
    }
  });
}

test.afterAll(async () => {
  const userIds = [...seededUserIds];
  seededUserIds.clear();
  await deleteSeededHabitLogs(userIds);
});

/** Reads the app's own weekly-consistency response for the current Córdoba week. */
async function readWeekConsistency(page: Page): Promise<WeekConsistency> {
  const response = await page.request.get('/api/stats/week');
  expect(response.status(), 'GET /api/stats/week should succeed').toBe(200);
  return (await response.json()) as WeekConsistency;
}

/**
 * The weekly-consistency card's per-day labels, read from the aria labels `WeekDayStrip`
 * renders: `Lunes`, `Lunes (hoy)`, `Martes (activo)`, `Martes (hoy, activo)`.
 */
async function readWeekStripLabels(page: Page): Promise<readonly string[]> {
  const labels = await page
    .getByRole('list', { name: 'Días de la semana' })
    .getByRole('listitem')
    .evaluateAll((nodes) =>
      nodes.map((node) => node.querySelector('div[aria-label]')?.getAttribute('aria-label') ?? '')
    );
  expect(labels, 'the weekly strip must render one cell per weekday').toHaveLength(7);
  return labels;
}

/** Reads the habit-activity window from the app's own HTTP contract. */
async function readWindow(page: Page, period?: HabitActivityPeriod): Promise<HabitActivityWindow> {
  const query = period === undefined ? '' : `?period=${period}`;
  const response = await page.request.get(`/api/stats/habits${query}`);
  expect(response.status(), `GET /api/stats/habits${query} should succeed`).toBe(200);
  return (await response.json()) as HabitActivityWindow;
}

/** The progress-page habit activity card, addressed only by its own heading. */
function progressHabitActivityCard(page: Page): Locator {
  return page
    .locator('div')
    .filter({ has: page.getByRole('heading', { name: CARD_TITLE, exact: true }) })
    .filter({ has: page.getByTestId('habit-activity-metrics') })
    .last();
}

/** The habits-page history section. */
function historySection(page: Page): Locator {
  return page.getByTestId('habit-activity-history');
}

/**
 * The habits-page activity card: the period selector plus the record it controls. The
 * selector and the record are siblings inside a {@link Card}, so the card is the innermost
 * element that owns both, and it also carries the weekday legend between them.
 */
function historyCard(page: Page): Locator {
  return page
    .locator('div')
    .filter({ has: activityPeriodControl(page) })
    .filter({ has: historySection(page) })
    .last();
}

/**
 * The exact accessible name of every day mark one habit strip must render, derived from the
 * response that rendered it: the window order, the Córdoba date and the state the API reports.
 */
function expectedMarkLabels(window: HabitActivityWindow, habitKey: HabitKey): readonly string[] {
  return window.days.map((day) => {
    const date = displayDate(day.localDate);
    if (day.isFuture) {
      return `${date}${DAY_FUTURE_SUFFIX}`;
    }
    return day.recordedKeys.includes(habitKey)
      ? `${date}${DAY_RECORDED_SUFFIX}`
      : `${date}${DAY_MISSING_SUFFIX}`;
  });
}

/**
 * The exact accessible name of every week cell, derived from `GET /api/stats/week`. The week
 * card is fed by ended workouts and daily check-ins, never by habit logs, so its own response
 * is the only honest expectation for it.
 */
function expectedWeekAriaLabels(week: WeekConsistency): readonly string[] {
  return week.days.map((day) => {
    const name = WEEK_DAY_NAMES[day.weekdayIndex];
    const notes = [day.isToday ? 'hoy' : null, day.active ? 'activo' : null].filter(
      (note) => note !== null
    );
    return notes.length > 0 ? `${name} (${notes.join(', ')})` : name;
  });
}

/**
 * Today's manual habit toggle. `HabitPreviewRow` renders the app's only checkbox, and both hosts
 * (`habits-list` on the habits page, `habit-preview-list` on today) share it, so the accessible
 * name alone addresses it on every page.
 */
function habitToggle(page: Page, key: HabitKey): Locator {
  return page.getByRole('checkbox', { name: HABIT_KEY_NAMES[key], exact: true });
}

/** Flips one habit through the real UI and returns once the write succeeded. */
async function toggleHabit(page: Page, key: HabitKey): Promise<void> {
  const writePromise = page.waitForResponse(
    (response) => response.url().includes('/api/habits') && response.request().method() === 'POST'
  );
  await habitToggle(page, key).click();
  expect((await writePromise).status()).toBe(200);
}

/** Day marks of one habit strip, read from the aria labels the app renders. */
async function readDayMarks(page: Page, habitName: string, expectedTotal: number): Promise<DayMarks> {
  const marks = historySection(page)
    .getByRole('list', { name: `Días registrados de ${habitName}` })
    .getByRole('listitem');
  await expect(marks).toHaveCount(expectedTotal);
  const labels = await marks.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('aria-label') ?? '')
  );
  return {
    total: labels.length,
    recorded: labels.filter((label) => label.endsWith(DAY_RECORDED_SUFFIX)).length,
    missing: labels.filter((label) => label.endsWith(DAY_MISSING_SUFFIX)).length,
    future: labels.filter((label) => label.endsWith(DAY_FUTURE_SUFFIX)).length,
    labels,
  };
}

/**
 * Navigates to a page and returns the habit-activity window that page itself fetched, so
 * every UI assertion is compared against the exact response the running app rendered.
 */
async function gotoHabitActivityPage(page: Page, path: string): Promise<HabitActivityWindow> {
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/stats/habits') && response.status() === 200
  );
  await page.goto(path);
  const response = await responsePromise;
  return (await response.json()) as HabitActivityWindow;
}

/**
 * Re-fetches the habit-activity window on the page already open, which is the only way the
 * history surfaces pick up a habit toggled after they first rendered: the card keeps its own
 * response and never observes the write.
 */
async function reloadHabitActivityPage(page: Page): Promise<HabitActivityWindow> {
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/stats/habits') && response.status() === 200
  );
  await page.reload();
  const response = await responsePromise;
  return (await response.json()) as HabitActivityWindow;
}

/** One habit row per day for the `days` most recent Córdoba days, ending today. */
function trailingSeedRows(days: number, habitKeys: readonly HabitKey[]): readonly SeedRow[] {
  const today = cordobaLocalDateOf(new Date());
  const rows: SeedRow[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const localDate = shiftLocalDate(today, -offset);
    for (const habitKey of habitKeys) {
      rows.push({ localDate, habitKey });
    }
  }
  return rows;
}

/** The state `getHabitActivityForUser` must report for the numbers in this response. */
function expectedInsightStatus(window: HabitActivityWindow): 'available' | 'insufficient' {
  return window.elapsedDays >= window.insightMinimumElapsedDays && window.activeDays > 0
    ? 'available'
    : 'insufficient';
}

/** Comparable snapshot of the recorded days, used to prove a round trip changed nothing. */
function recordedDaySnapshot(
  window: HabitActivityWindow
): ReadonlyArray<{ localDate: string; recordedKeys: readonly HabitKey[] }> {
  return window.days
    .filter((day) => day.isRecorded)
    .map((day) => ({ localDate: day.localDate, recordedKeys: [...day.recordedKeys].sort() }));
}

/** The habits-page history window selector. */
function activityPeriodControl(page: Page): Locator {
  return page.getByRole('radiogroup', { name: ACTIVITY_PERIOD_GROUP_NAME });
}

/**
 * Switches the history window and returns the response that rendered it, which is the
 * only way to prove the selector, the window and the day marks agree with each other.
 */
async function selectHistoryPeriod(
  page: Page,
  period: HabitActivityPeriod
): Promise<HabitActivityWindow> {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/stats/habits?period=${period}`) && response.status() === 200
  );
  const option = activityPeriodControl(page).getByRole('radio', {
    name: PERIOD_LABELS[period],
    exact: true,
  });
  await option.click();
  const response = await responsePromise;
  await expect(option).toHaveAttribute('aria-checked', 'true');
  return (await response.json()) as HabitActivityWindow;
}

/** Switches the progress-page period and returns the response that rendered the card. */
async function selectProgressPeriod(
  page: Page,
  period: HabitActivityPeriod
): Promise<HabitActivityWindow> {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/stats/habits?period=${period}`) && response.status() === 200
  );
  const option = page
    .getByRole('radiogroup', { name: PROGRESS_PERIOD_GROUP_NAME })
    .getByRole('radio', { name: PERIOD_LABELS[period], exact: true });
  await option.click();
  const response = await responsePromise;
  await expect(option).toHaveAttribute('aria-checked', 'true');
  return (await response.json()) as HabitActivityWindow;
}

/** No metric may ever surface a placeholder or a serialization artifact. */
async function expectNoPlaceholderReading(scope: Locator): Promise<void> {
  for (const reading of FORBIDDEN_METRIC_READINGS) {
    await expect(scope).not.toContainText(reading);
  }
}

// Every test here writes fixture rows directly into the one local SQLite file the app also
// serves from. Concurrent writers make SQLite answer SQLITE_BUSY, so this file runs its tests
// in one worker, in order — the same single-worker shape CI uses.
test.describe.configure({ mode: 'serial' });

test.describe('Habit activity readback', () => {
  test.describe('API contract', () => {
    test('week window is the current Córdoba Monday-to-Sunday week', async ({ page }) => {
      await registerFreshUser(page);
      const window = await readWindow(page, 'week');
      const expected = expectedWindowFor('week', cordobaLocalDateOf(new Date()));

      expect(window.period).toBe('week');
      expect(window.windowStart).toBe(expected.start);
      expect(window.windowEnd).toBe(expected.end);
      expect(weekdayIndex(window.windowStart)).toBe(0);
      expect(weekdayIndex(window.windowEnd)).toBe(6);
      expect(window.insightMinimumElapsedDays).toBe(INSIGHT_MINIMUM_ELAPSED_DAYS);
    });

    test('reports every window day in order with the recorded flags', async ({ page }) => {
      await registerFreshUser(page);
      const window = await readWindow(page, 'week');
      const today = cordobaLocalDateOf(new Date());

      expect(window.days).toHaveLength(DAYS_PER_PERIOD.week);
      expect(window.days.map((day) => day.localDate)).toEqual(
        Array.from({ length: DAYS_PER_PERIOD.week }, (_, index) => shiftLocalDate(window.windowStart, index))
      );
      expect(window.days[0].localDate).toBe(window.windowStart);
      expect(window.days[window.days.length - 1].localDate).toBe(window.windowEnd);
      for (const [index, day] of window.days.entries()) {
        expect(day.weekdayIndex, `weekdayIndex of ${day.localDate}`).toBe(index);
      }
      expect(window.days.filter((day) => day.isToday).map((day) => day.localDate)).toEqual([today]);
    });

    test('derives the day state flags from the Córdoba calendar', async ({ page }) => {
      await registerFreshUser(page);
      const window = await readWindow(page, 'week');
      const today = cordobaLocalDateOf(new Date());

      for (const day of window.days) {
        expect(day.isFuture, `isFuture of ${day.localDate}`).toBe(day.localDate > today);
        expect(day.isToday, `isToday of ${day.localDate}`).toBe(day.localDate === today);
        expect(day.isRecorded).toBe(day.recordedKeys.length > 0);
        if (day.isFuture) {
          expect(day.recordedKeys, `future day ${day.localDate} must not report habits`).toEqual([]);
        }
      }
      expect(window.elapsedDays).toBe(window.days.filter((day) => !day.isFuture).length);
      expect(window.elapsedDays).toBeGreaterThanOrEqual(1);
      expect(window.elapsedDays).toBeLessThanOrEqual(DAYS_PER_PERIOD.week);
    });

    test('a brand-new account reports an empty, insufficient history', async ({ page }) => {
      await registerFreshUser(page);
      const window = await readWindow(page, 'week');

      expect(window.activeDays).toBe(0);
      expect(window.days.filter((day) => day.isRecorded)).toHaveLength(0);
      expect(Object.keys(window.perHabit).sort()).toEqual(Object.keys(HABIT_KEY_NAMES).sort());
      for (const key of Object.keys(HABIT_KEY_NAMES) as HabitKey[]) {
        expect(window.perHabit[key].activeDays, `perHabit.${key}.activeDays`).toBe(0);
      }
      expect(window.insightStatus).toBe('insufficient');
    });

    test('month and quarter windows are the trailing 30 and 90 days', async ({ page }) => {
      await registerFreshUser(page);
      const today = cordobaLocalDateOf(new Date());

      for (const period of ['month', 'quarter'] as const) {
        const window = await readWindow(page, period);
        const expected = expectedWindowFor(period, today);
        expect(window.period).toBe(period);
        expect(window.windowStart).toBe(expected.start);
        expect(window.windowEnd).toBe(today);
        expect(window.days).toHaveLength(DAYS_PER_PERIOD[period]);
        expect(weekdayIndex(window.days[0].localDate)).toBe(weekdayIndex(expected.start));
        expect(window.days[window.days.length - 1].localDate).toBe(today);
        expect(window.elapsedDays).toBe(DAYS_PER_PERIOD[period]);
        expect(window.days.filter((day) => day.isFuture)).toHaveLength(0);
      }
    });

    test('rejects an unknown period and defaults to week when omitted', async ({ page }) => {
      await registerFreshUser(page);

      const invalid = await page.request.get('/api/stats/habits?period=diario');
      expect(invalid.status()).toBe(400);
      const invalidBody: unknown = await invalid.json();
      expect(invalidBody).toMatchObject({
        code: 'VALIDATION',
        message: 'Período de actividad de hábitos inválido',
      });

      const defaulted = await readWindow(page);
      expect(defaulted.period).toBe('week');
      expect(defaulted.days).toHaveLength(DAYS_PER_PERIOD.week);
    });

    test('requires an authenticated session', async ({ browser }) => {
      const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      try {
        const request = anonymous.request;
        const response = await request.get('/api/stats/habits?period=week');
        expect(response.status()).toBe(401);
        expect(await response.json()).toMatchObject({
          code: 'UNAUTHORIZED',
          message: 'Autenticación requerida',
        });
      } finally {
        await anonymous.close();
      }
    });
  });

  test.describe('Progress card', () => {
    test('states the recorded days and the elapsed days of the window it rendered', async ({
      page,
    }) => {
      const identity = await registerFreshUser(page);
      await seedHabitLogs(identity.id, trailingSeedRows(3, ['hydration', 'walk']));

      await gotoHabitActivityPage(page, '/dashboard/progress');
      // The progress page opens on the 30-day window, so that is the window the card rendered.
      const window = await readWindow(page, 'month');
      expect(window.period).toBe('month');
      expect(window.windowEnd).toBe(cordobaLocalDateOf(new Date()));
      expect(window.elapsedDays).toBe(DAYS_PER_PERIOD.month);
      expect(window.activeDays).toBe(3);
      expect(window.perHabit.hydration.activeDays).toBe(3);
      expect(window.perHabit.walk.activeDays).toBe(3);
      expect(window.perHabit.mobility.activeDays).toBe(0);
      expect(window.perHabit.sleep.activeDays).toBe(0);
      expect(window.insightStatus).toBe('available');

      const card = progressHabitActivityCard(page);
      await expect(card.getByRole('heading', { name: CARD_TITLE, exact: true })).toBeVisible();
      await expect(
        card.getByText(windowCaption(displayDate(window.windowStart), displayDate(window.windowEnd)))
      ).toBeVisible();

      const metrics = card.getByTestId('habit-activity-metrics');
      await expect(
        metrics.getByText(summarySentence(window.activeDays, window.elapsedDays))
      ).toBeVisible();
      await expect(
        metrics.getByText(`${ACTIVE_DAYS_LABEL}: ${window.activeDays}`, { exact: true })
      ).toBeVisible();
      await expect(
        metrics.getByText(`${ELAPSED_DAYS_LABEL}: ${window.elapsedDays}`, { exact: true })
      ).toBeVisible();
      await expect(metrics.getByText(PROVENANCE_LABEL, { exact: true })).toHaveCount(2);

      // A day count is never turned into a share of a goal, and no reading is a placeholder.
      await expect(card).not.toContainText('%');
      await expect(card.getByRole('progressbar')).toHaveCount(0);
      await expectNoPlaceholderReading(metrics);
    });

    test('renders the elapsed days of the 30-day and 90-day windows', async ({ page }) => {
      await registerFreshUser(page);
      await gotoHabitActivityPage(page, '/dashboard/progress');

      const month = await readWindow(page, 'month');
      expect(month.elapsedDays).toBe(DAYS_PER_PERIOD.month);
      const monthMetrics = progressHabitActivityCard(page).getByTestId('habit-activity-metrics');
      await expect(
        monthMetrics.getByText(`${ELAPSED_DAYS_LABEL}: ${DAYS_PER_PERIOD.month}`, { exact: true })
      ).toBeVisible();

      const quarter = await selectProgressPeriod(page, 'quarter');
      expect(quarter.period).toBe('quarter');
      expect(quarter.elapsedDays).toBe(DAYS_PER_PERIOD.quarter);
      const quarterMetrics = progressHabitActivityCard(page).getByTestId('habit-activity-metrics');
      await expect(
        quarterMetrics.getByText(`${ELAPSED_DAYS_LABEL}: ${DAYS_PER_PERIOD.quarter}`, {
          exact: true,
        })
      ).toBeVisible();

      // A brand-new account has nothing recorded, so the wider window states the missing
      // activity instead of reporting a zero as a reading.
      expect(quarter.activeDays).toBe(0);
      await expect(quarterMetrics.getByText(INSUFFICIENT_NO_ACTIVITY)).toBeVisible();
      await expect(quarterMetrics.getByText(`${ACTIVE_DAYS_LABEL}: 0`, { exact: true })).toHaveCount(
        0
      );
    });

    test('shows only the state the week window itself allows', async ({ page }) => {
      const identity = await registerFreshUser(page);
      await seedHabitLogs(identity.id, trailingSeedRows(1, ['sleep']));

      await gotoHabitActivityPage(page, '/dashboard/progress');
      const week = await selectProgressPeriod(page, 'week');
      expect(week.period).toBe('week');
      expect(week.activeDays).toBe(1);

      const metrics = progressHabitActivityCard(page).getByTestId('habit-activity-metrics');
      if (expectedInsightStatus(week) === 'available') {
        await expect(
          metrics.getByText(summarySentence(week.activeDays, week.elapsedDays))
        ).toBeVisible();
        await expect(
          metrics.getByText(`${ACTIVE_DAYS_LABEL}: ${week.activeDays}`, { exact: true })
        ).toBeVisible();
        await expect(
          metrics.getByRole('heading', { name: INSUFFICIENT_TITLE, exact: true })
        ).toHaveCount(0);
      } else {
        await expect(
          metrics.getByRole('heading', { name: INSUFFICIENT_TITLE, exact: true })
        ).toBeVisible();
        await expect(
          metrics.getByText(
            insufficientElapsedSentence(week.elapsedDays, week.insightMinimumElapsedDays)
          )
        ).toBeVisible();
        // Something is recorded today, so the window is short — it does not claim no activity.
        await expect(metrics.getByText(INSUFFICIENT_NO_ACTIVITY)).toHaveCount(0);
        await expect(metrics.getByText(ACTIVE_DAYS_LABEL)).toHaveCount(0);
      }
      expect(week.insightStatus).toBe(expectedInsightStatus(week));

      // The same account is summarisable over 30 days, so the two windows disagree on purpose.
      const month = await readWindow(page, 'month');
      expect(month.activeDays).toBe(1);
      expect(month.insightStatus).toBe('available');
    });

    test('marks the week card only on the days the week API reports', async ({ page }) => {
      const identity = await registerFreshUser(page);
      // Habit logs are not weekly activity: the week card stays driven by ended workouts and
      // daily check-ins, so seeding seven days of habits must not inflate it.
      await seedHabitLogs(identity.id, trailingSeedRows(7, HABIT_KEYS));

      await gotoHabitActivityPage(page, '/dashboard/progress');
      const week = await readWeekConsistency(page);

      expect(week.days).toHaveLength(7);
      expect(week.days.map((day) => day.weekdayIndex)).toEqual([0, 1, 2, 3, 4, 5, 6]);
      expect(week.activeCount).toBe(week.days.filter((day) => day.active).length);

      await expect(
        page.getByRole('list', { name: WEEK_STRIP_NAME }).getByRole('listitem')
      ).toHaveCount(7);
      expect(await readWeekStripLabels(page)).toEqual(expectedWeekAriaLabels(week));
    });

    test('keeps the wellbeing reading out of the window the habit card shows', async ({ page }) => {
      await registerFreshUser(page);
      await gotoHabitActivityPage(page, '/dashboard/progress');
      await selectProgressPeriod(page, 'quarter');

      const wellbeing = page
        .locator('div')
        .filter({ has: page.getByRole('heading', { name: WELLBEING_TITLE, exact: true }) })
        .filter({ hasText: WELLBEING_WINDOW_LABEL })
        .last();

      await expect(wellbeing).toBeVisible();
      // The selected window is a 90-day one, and the wellbeing card must not read as aggregated.
      await expect(wellbeing).not.toContainText('días');
      await expect(wellbeing).not.toContainText(String(DAYS_PER_PERIOD.quarter));
    });
  });

  test.describe('History windows', () => {
    test('re-windows the day marks to the period the response covers', async ({ page }) => {
      await registerFreshUser(page);
      await gotoHabitActivityPage(page, '/dashboard/habits');
      await expect(
        historyCard(page).getByRole('heading', { name: HISTORY_TITLE, exact: true })
      ).toBeVisible();

      const week = await readWindow(page, 'week');
      expect(week.period).toBe('week');
      expect((await readDayMarks(page, HABIT_KEY_NAMES.mobility, DAYS_PER_PERIOD.week)).labels).toEqual(
        expectedMarkLabels(week, 'mobility')
      );

      const month = await selectHistoryPeriod(page, 'month');
      expect(month.days).toHaveLength(DAYS_PER_PERIOD.month);
      expect(month.activeDays).toBe(0);
      expect(
        (await readDayMarks(page, HABIT_KEY_NAMES.mobility, DAYS_PER_PERIOD.month)).labels
      ).toEqual(expectedMarkLabels(month, 'mobility'));

      const quarter = await selectHistoryPeriod(page, 'quarter');
      expect(quarter.elapsedDays).toBe(DAYS_PER_PERIOD.quarter);
      expect(
        (await readDayMarks(page, HABIT_KEY_NAMES.mobility, DAYS_PER_PERIOD.quarter)).labels
      ).toEqual(expectedMarkLabels(quarter, 'mobility'));

      const backToWeek = await selectHistoryPeriod(page, 'week');
      expect(
        (await readDayMarks(page, HABIT_KEY_NAMES.mobility, DAYS_PER_PERIOD.week)).labels
      ).toEqual(expectedMarkLabels(backToWeek, 'mobility'));

      await historySection(page).scrollIntoViewIfNeeded();
      await expectNoHorizontalOverflow(page);
    });

    test('lists the three periods the activity control offers', async ({ page }) => {
      await registerFreshUser(page);
      await gotoHabitActivityPage(page, '/dashboard/habits');
      await expect(
        historyCard(page).getByRole('heading', { name: HISTORY_TITLE, exact: true })
      ).toBeVisible();

      const control = activityPeriodControl(page);
      await expect(control.getByRole('radio')).toHaveCount(3);
      await expect(
        control.getByRole('radio', { name: PERIOD_LABELS.week, exact: true })
      ).toHaveAttribute('aria-checked', 'true');
    });

    test('explains the record in Córdoba time, day by day', async ({ page }) => {
      await registerFreshUser(page);
      await gotoHabitActivityPage(page, '/dashboard/habits');

      await expect(
        historyCard(page).getByText(
          'Cada marca es un día, de lunes a domingo, en hora de Córdoba.',
          { exact: true }
        )
      ).toBeVisible();
      await expect(
        historySection(page).getByText(
          windowCaption(
            displayDate((await readWindow(page, 'week')).windowStart),
            displayDate((await readWindow(page, 'week')).windowEnd)
          )
        )
      ).toBeVisible();
      await expect(historyCard(page).getByText('Registrado', { exact: true })).toBeVisible();
      await expect(historyCard(page).getByText('Sin registro', { exact: true })).toBeVisible();
      await expect(historyCard(page).getByText('Todavía no llegó', { exact: true })).toBeVisible();
    });

    test('states a per-habit recorded-day count with its provenance', async ({ page }) => {
      const identity = await registerFreshUser(page);
      await seedHabitLogs(identity.id, trailingSeedRows(4, HABIT_KEYS));

      await gotoHabitActivityPage(page, '/dashboard/habits');
      const month = await selectHistoryPeriod(page, 'month');
      expect(month.activeDays).toBe(4);
      expect(month.insightStatus).toBe('available');

      const strips = page.getByTestId('habit-activity-strips');
      for (const key of HABIT_KEYS) {
        expect(month.perHabit[key].activeDays).toBe(4);
        await expect(
          strips.getByText(recordedDaysLabel(HABIT_KEY_NAMES[key], 4, DAYS_PER_PERIOD.month), {
            exact: true,
          })
        ).toBeVisible();
      }
      await expect(strips.getByText(PROVENANCE_LABEL, { exact: true })).toHaveCount(HABIT_TOTAL);
      await expect(strips).not.toContainText('%');
      await expectNoPlaceholderReading(strips);
    });
  });

  test.describe('Manual habit readback', () => {
    test('reports one recorded habit as a count and as a marked day', async ({ page }) => {
      await registerFreshUser(page);
      await gotoHabitActivityPage(page, '/dashboard/habits');

      await expect(
        page.getByText(completedLabel(0, HABIT_TOTAL), { exact: true })
      ).toBeVisible();
      await expect(
        page.getByText(todayOnlySentence(0, HABIT_TOTAL), { exact: true })
      ).toBeVisible();

      await toggleHabit(page, 'sleep');
      const window = await reloadHabitActivityPage(page);
      expect(window.period).toBe('week');
      expect(window.activeDays).toBe(1);
      expect(window.perHabit.sleep.activeDays).toBe(1);

      await expect(
        page.getByText(completedLabel(1, HABIT_TOTAL), { exact: true })
      ).toBeVisible();
      await expect(
        page.getByText(todayOnlySentence(1, HABIT_TOTAL), { exact: true })
      ).toBeVisible();

      const marks = await readDayMarks(page, HABIT_KEY_NAMES.sleep, DAYS_PER_PERIOD.week);
      expect(marks.recorded).toBe(1);
      expect(marks.future).toBe(window.days.filter((day) => day.isFuture).length);
      expect(marks.missing).toBe(DAYS_PER_PERIOD.week - marks.recorded - marks.future);
    });

    test('shows the same recorded days after signing out and back in', async ({ page }) => {
      const identity = await registerFreshUser(page);
      await gotoHabitActivityPage(page, '/dashboard/habits');
      await toggleHabit(page, 'mobility');

      const before = recordedDaySnapshot(await reloadHabitActivityPage(page));
      expect(before.length).toBeGreaterThan(0);
      const marksBefore = await readDayMarks(page, HABIT_KEY_NAMES.mobility, DAYS_PER_PERIOD.week);
      expect(marksBefore.recorded).toBe(before.length);

      await logout(page);
      await login(page, identity.email);

      await gotoHabitActivityPage(page, '/dashboard/habits');
      expect(recordedDaySnapshot(await readWindow(page, 'week'))).toEqual(before);
      expect(
        await readDayMarks(page, HABIT_KEY_NAMES.mobility, DAYS_PER_PERIOD.week)
      ).toEqual(marksBefore);
    });
  });

  test.describe('Copy contract', () => {
    test('describes habit activity without adherence, goal or scorekeeping language', async ({
      page,
    }) => {
      const identity = await registerFreshUser(page);
      await seedHabitLogs(identity.id, trailingSeedRows(2, ['mobility', 'sleep']));

      await gotoHabitActivityPage(page, '/dashboard/habits');
      const month = await selectHistoryPeriod(page, 'month');
      expect(month.insightStatus).toBe('available');

      const card = historyCard(page);
      await expect(card).toBeVisible();
      const rendered = await card.innerText();
      expect(rendered.toLowerCase()).not.toMatch(FORBIDDEN_ACTIVITY_VOCABULARY);
      expect(rendered).toContain('días con registro');
      await expectNoPlaceholderReading(card);
    });
  });

  test.describe('Mobile viewport', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('fits the habit-activity record without horizontal overflow', async ({ page }) => {
      const identity = await registerFreshUser(page);
      await seedHabitLogs(identity.id, trailingSeedRows(2, HABIT_KEYS));

      await gotoHabitActivityPage(page, '/dashboard/habits');
      await selectHistoryPeriod(page, 'month');
      await expect(
        historyCard(page).getByRole('heading', { name: HISTORY_TITLE, exact: true })
      ).toBeVisible();
      await expect(
        page.getByTestId('habit-activity-strips').getByRole('list').first().getByRole('listitem')
      ).toHaveCount(DAYS_PER_PERIOD.month);
      await historySection(page).scrollIntoViewIfNeeded();
      await expectNoHorizontalOverflow(page);
    });
  });
});
