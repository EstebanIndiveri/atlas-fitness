import { expect, test, type Locator, type Page } from '@playwright/test';

import { registerAndCompleteTestAccount } from './helpers/auth';
import { expectNoHorizontalOverflow } from './helpers/viewport';
import type { AuthUser } from '../types/auth';
import type { HabitKey } from '../types/habit';
import type {
  HabitTargetAdherencePeriod,
  HabitTargetAdherenceWindow,
  HabitTargetHabitAdherence,
} from '../types/habit-adherence';
import type { HabitTargetResponse } from '../lib/api/habit-targets';
import type { HabitTargetWeekday } from '../types/habit-target';

/**
 * End-to-end proof of the v0.10 habit-target loop and its compatibility with the
 * v0.9 observed-activity read path (Workstream F, brief §16 QA contract).
 *
 * Every test registers a brand-new account through the real `/register` form and
 * then drives the real API and pages, so an assertion can never be satisfied by
 * another test's data. Values and states are read back from `/api/habit-targets`
 * and `/api/stats/habit-adherence` and compared against the exact copy the UI
 * renders; nothing is stubbed and no page is asserted only for rendering.
 *
 * Determinism against the real clock. `effectiveFrom` is always the current
 * Córdoba day, so the golden "today is expected" path selects all seven weekdays
 * rather than hardcoding a weekday. The only negative path that depends on the
 * weekday computes today's Córdoba Sunday-first weekday and deliberately picks a
 * different one, which can never match today. The version-boundary test derives
 * its own past dates from today and seeds a fixture schedule in the database the
 * app under test reads (the same allow-listed local SQLite file `habit-activity`
 * uses), then drives the real API to close it and prove prior dates keep the old
 * version.
 */

const HABIT_KEY_NAMES: Record<HabitKey, string> = {
  hydration: 'Hidratación',
  walk: 'Pasos Activos',
  mobility: 'Movilidad',
  sleep: 'Descanso & Sueño',
};

/** Every Sunday-first weekday, sorted ascending (`0 = Sunday … 6 = Saturday`). */
const ALL_WEEKDAYS: readonly HabitTargetWeekday[] = [0, 1, 2, 3, 4, 5, 6];

/** Accessible names of the weekday selector buttons, in Monday-first display order. */
const WEEKDAY_BUTTON_NAMES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const;

/** `HABIT_TARGET_COPY` strings this spec asserts against. */
const TARGET_COPY = {
  sectionTitle: 'Mis días objetivo',
  objectiveToday: 'Objetivo de hoy',
  save: 'Guardar cambios',
  deactivate: 'Desactivar objetivo',
  confirmDeactivate: 'Confirmar desactivación',
  historyTitle: 'Cumplimiento de objetivos',
  historyEmpty: 'Todavía no transcurrió un día objetivo en este período.',
  weekdayGroupAria: (habitName: string) => `Días objetivo de ${habitName}`,
  extraRecordedLabel: (count: number) =>
    count === 1 ? '1 registro fuera de objetivo' : `${count} registros fuera de objetivo`,
} as const;

/** `PROGRESS_COPY.habitTarget` strings this spec asserts against. */
const PROGRESS_TARGET_COPY = {
  cardTitle: 'Días objetivo cumplidos',
  resultLabel: (completed: number, expected: number) =>
    `${completed} de ${expected} días objetivo`,
  percentLabel: (percent: number) => `${percent}%`,
  provenance: 'Compara tus registros reales con los días objetivo que definiste.',
  extraLabel: (extra: number) =>
    extra === 1
      ? '1 día registrado fuera de objetivo (no cuenta en el resultado)'
      : `${extra} días registrados fuera de objetivo (no cuentan en el resultado)`,
  windowLabel: (from: string, to: string) =>
    `Cumplimiento del ${from} al ${to} (hora de Córdoba)`,
} as const;

const COUNT_LABEL_PATTERN = /\d+ de \d+ días objetivo/;

/**
 * Database the fixture rows are written to. Mirrors `playwright.config.ts:43`,
 * which starts the app under test against the same expression, so the spec can
 * only ever seed the database the running app reads.
 */
const FIXTURE_DATABASE_URL = process.env.TURSO_DATABASE_URL || 'file:./local.db';

const TEST_PASSWORD = 'Test1234!';

/** Córdoba local calendar date (`YYYY-MM-DD`) for an instant, defaulting to now. */
function cordobaLocalDateOf(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Cordoba',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

function cordobaToday(): string {
  return cordobaLocalDateOf(new Date());
}

/** Shifts a `YYYY-MM-DD` date by whole days on the proleptic Gregorian calendar. */
function shiftLocalDate(localDate: string, days: number): string {
  const [year, month, day] = localDate.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day));
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

/** Sunday-first weekday (`0 = Sunday … 6 = Saturday`) of a `YYYY-MM-DD` date. */
function sundayFirstWeekday(localDate: string): HabitTargetWeekday {
  const [year, month, day] = localDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() as HabitTargetWeekday;
}

/** `YYYY-MM-DD` rendered the way the product shows it: `DD/MM/YYYY`. */
function displayDate(localDate: string): string {
  const [year, month, day] = localDate.split('-');
  return `${day}/${month}/${year}`;
}

interface SessionIdentity {
  readonly id: number;
  readonly email: string;
}

/** Reads the signed-in account id/email from the session-protected profile API. */
async function readSessionIdentity(page: Page): Promise<SessionIdentity> {
  const response = await page.request.get('/api/auth/me');
  expect(response.status(), 'GET /api/auth/me should succeed for a signed-in user').toBe(200);
  const user = (await response.json()) as AuthUser;
  expect(typeof user.id, 'the session user must expose a numeric id').toBe('number');
  expect(typeof user.email, 'the session user must expose an email').toBe('string');
  return { id: user.id, email: user.email };
}

/** Signs the current session out through the real navigation control. */
async function logout(page: Page): Promise<void> {
  await Promise.all([
    page.waitForURL('/login', { timeout: 15000 }),
    page.getByRole('button', { name: 'Cerrar sesión' }).click(),
  ]);
}

/** Signs back in through the real login form and waits for the authenticated shell. */
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

/** Reads the user's active targets through the real HTTP contract. */
async function readTargets(page: Page): Promise<HabitTargetResponse[]> {
  const response = await page.request.get('/api/habit-targets');
  expect(response.status(), 'GET /api/habit-targets should succeed').toBe(200);
  return (await response.json()) as HabitTargetResponse[];
}

/** Reads the target-adherence window through the real HTTP contract. */
async function readAdherence(
  page: Page,
  period: HabitTargetAdherencePeriod,
): Promise<HabitTargetAdherenceWindow> {
  const response = await page.request.get(`/api/stats/habit-adherence?period=${period}`);
  expect(response.status(), `GET /api/stats/habit-adherence?period=${period} should succeed`).toBe(
    200,
  );
  return (await response.json()) as HabitTargetAdherenceWindow;
}

/** Creates a target with the explicit create token (`null`/`null`) and expects `201`. */
async function createTarget(
  page: Page,
  habitKey: HabitKey,
  weekdays: readonly HabitTargetWeekday[],
): Promise<HabitTargetResponse> {
  const response = await page.request.put(`/api/habit-targets/${habitKey}`, {
    data: { weekdays, expectedTargetId: null, expectedVersion: null },
  });
  expect(response.status(), `PUT /api/habit-targets/${habitKey} (create) should return 201`).toBe(
    201,
  );
  return (await response.json()) as HabitTargetResponse;
}

/** Narrows the single active target of a habit, failing loudly when it is absent. */
function targetFor(
  targets: readonly HabitTargetResponse[],
  habitKey: HabitKey,
): HabitTargetResponse {
  const target = targets.find((entry) => entry.habitKey === habitKey);
  expect(target, `an active ${habitKey} target must be returned`).toBeDefined();
  return target as HabitTargetResponse;
}

/** One calendar day of the adherence window, failing loudly when it is out of window. */
function dayFor(window: HabitTargetAdherenceWindow, localDate: string) {
  const day = window.days.find((entry) => entry.localDate === localDate);
  if (day === undefined) {
    throw new Error(`day ${localDate} is outside the ${window.period} adherence window`);
  }
  return day;
}

/** The habit row rendered by the Habits configuration section. */
function targetRow(page: Page, habitKey: HabitKey): Locator {
  return page.getByTestId(`habit-target-row-${habitKey}`);
}

/** The `Objetivo de hoy` badge inside the Habits configuration row of one habit. */
function settingsTodayBadge(page: Page, habitKey: HabitKey): Locator {
  return targetRow(page, habitKey).getByTestId(`habit-target-today-${habitKey}`);
}

/** The `Objetivo de hoy` badge inside the Today habit list of one habit. */
function todayListBadge(page: Page, habitKey: HabitKey): Locator {
  return page
    .getByTestId('habit-preview-list')
    .getByTestId(`habit-target-today-${habitKey}`);
}

/** The Progress target-adherence result box, scoped to its own test handle. */
function progressAdherenceResult(page: Page): Locator {
  return page.getByTestId('habit-target-adherence-result');
}

/** The Progress target-adherence empty box, scoped to its own test handle. */
function progressAdherenceEmpty(page: Page): Locator {
  return page.getByTestId('habit-target-adherence-empty');
}

/** Selects every weekday of one habit through the real accessible selector. */
async function selectAllWeekdaysFor(page: Page, habitName: string): Promise<void> {
  const group = page.getByRole('group', { name: TARGET_COPY.weekdayGroupAria(habitName) });
  for (const name of WEEKDAY_BUTTON_NAMES) {
    await group.getByRole('button', { name, exact: true }).click();
  }
}

/** Flips one habit through the real checkbox and returns once the write succeeded. */
async function toggleHabit(page: Page, habitKey: HabitKey): Promise<void> {
  const writePromise = page.waitForResponse(
    (response) => response.url().includes('/api/habits') && response.request().method() === 'POST',
  );
  await page.getByRole('checkbox', { name: HABIT_KEY_NAMES[habitKey], exact: true }).click();
  expect((await writePromise).status()).toBe(200);
}

/** Refuses any fixture database that is not the local file database the app reads. */
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
  // The app serves from this same file, so a write overlapping a request would
  // otherwise be rejected with SQLITE_BUSY instead of waiting its turn.
  await database.execute('PRAGMA busy_timeout = 5000');
  return database;
}

type FixtureDatabase = Awaited<ReturnType<typeof connectFixtureDatabase>>;

/** Runs one fixture statement set against the local database and always closes it. */
async function withFixtureDatabase(
  run: (database: FixtureDatabase) => Promise<void>,
): Promise<void> {
  const database = await connectFixtureDatabase();
  try {
    await run(database);
  } finally {
    database.close();
  }
}

/** Account ids this worker seeded, so `afterAll` deletes exactly its own rows. */
const seededUserIds = new Set<number>();

interface SeedScheduleParams {
  userId: number;
  habitKey: HabitKey;
  effectiveFrom: string;
  effectiveTo: string | null;
  version: number;
  weekdays: readonly HabitTargetWeekday[];
}

/**
 * Writes one historical/current schedule version for a throwaway account.
 *
 * The product only ever starts a version today, so a version with a past
 * `effectiveFrom` can only be prepared through the fixture database. This is
 * fixture setup, not the subject under test: the write that closes it and
 * advances the version always goes through the real API.
 */
async function seedTargetSchedule(params: SeedScheduleParams): Promise<number> {
  const database = await connectFixtureDatabase();
  try {
    const inserted = await database.execute({
      sql: 'INSERT INTO habit_target_schedules (user_id, habit_key, effective_from, effective_to, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, unixepoch(), unixepoch())',
      args: [
        params.userId,
        params.habitKey,
        params.effectiveFrom,
        params.effectiveTo,
        params.version,
      ],
    });
    const scheduleId = Number(inserted.lastInsertRowid);
    for (const dayOfWeek of params.weekdays) {
      await database.execute({
        sql: 'INSERT INTO habit_target_days (schedule_id, day_of_week) VALUES (?, ?)',
        args: [scheduleId, dayOfWeek],
      });
    }
    seededUserIds.add(params.userId);
    return scheduleId;
  } finally {
    database.close();
  }
}

/** Writes one recorded past day for a throwaway account. */
async function seedHabitLog(
  userId: number,
  localDate: string,
  habitKey: HabitKey,
): Promise<void> {
  await withFixtureDatabase(async (database) => {
    await database.execute({
      sql: 'INSERT INTO habit_logs (user_id, local_date, habit_key, done) VALUES (?, ?, ?, 1)',
      args: [userId, localDate, habitKey],
    });
  });
  seededUserIds.add(userId);
}

/** Deletes every fixture row written for the given accounts. */
async function deleteSeededRows(userIds: readonly number[]): Promise<void> {
  if (userIds.length === 0) {
    return;
  }
  await withFixtureDatabase(async (database) => {
    for (const userId of userIds) {
      await database.execute({
        sql: 'DELETE FROM habit_target_schedules WHERE user_id = ?',
        args: [userId],
      });
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
  await deleteSeededRows(userIds);
});

// The single local SQLite file is shared by the app and every fixture write, so
// this file runs its tests serially in one worker to avoid SQLITE_BUSY.
test.describe.configure({ mode: 'serial', timeout: 60_000 });

test.describe('Habit targets — integration', () => {
  test.describe('Configuration and persistence', () => {
    test('creates a target through the Habits UI and reads it back after reload and re-auth', async ({
      page,
    }) => {
      await registerAndCompleteTestAccount(page, 'Objetivo Persistente');

      await page.goto('/dashboard/habits');
      await expect(
        page.getByRole('heading', { name: TARGET_COPY.sectionTitle, exact: true }),
      ).toBeVisible();

      await selectAllWeekdaysFor(page, HABIT_KEY_NAMES.walk);
      const writePromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/habit-targets/walk') &&
          response.request().method() === 'PUT' &&
          response.status() === 201,
      );
      await targetRow(page, 'walk')
        .getByRole('button', { name: TARGET_COPY.save, exact: true })
        .click();
      expect((await writePromise).status()).toBe(201);

      const today = cordobaToday();
      const created = targetFor(await readTargets(page), 'walk');
      expect(created.effectiveFrom).toBe(today);
      expect(created.effectiveTo).toBeNull();
      expect(created.version).toBe(1);
      expect([...created.weekdays].sort((a, b) => a - b)).toEqual([...ALL_WEEKDAYS]);

      // The UI rendered the exact persisted schedule, and today is expected.
      await expect(
        targetRow(page, 'walk').getByText('Días objetivo: Domingo, Lunes, Martes, Miércoles, Jueves, Viernes, Sábado', {
          exact: true,
        }),
      ).toBeVisible();
      await expect(settingsTodayBadge(page, 'walk')).toBeVisible();

      // Reload keeps the same persisted row.
      await page.reload();
      const afterReload = targetFor(await readTargets(page), 'walk');
      expect(afterReload).toEqual(created);

      // Sign out and back in: the re-authenticated session reads the same target.
      const identity = await readSessionIdentity(page);
      await logout(page);
      await login(page, identity.email);
      const afterReauth = targetFor(await readTargets(page), 'walk');
      expect(afterReauth).toEqual(created);

      const adherence = await readAdherence(page, 'month');
      expect(adherence.metricState).toBe('result');
      expect(adherence.expectedHabitDays).toBe(1);
      expect(adherence.perHabit.walk.expectedHabitDays).toBe(1);
      expect(adherence.perHabit.walk.configurationState).toBe('configured');
    });

    test('marks Objetivo de hoy only for a habit whose selected weekday is today', async ({
      page,
    }) => {
      await registerAndCompleteTestAccount(page, 'Objetivo Hoy');

      const today = cordobaToday();
      // Selecting all seven days guarantees today is an objective.
      await createTarget(page, 'walk', ALL_WEEKDAYS);
      // A single weekday deliberately different from today can never match.
      const notToday = ((sundayFirstWeekday(today) + 3) % 7) as HabitTargetWeekday;
      expect(notToday).not.toBe(sundayFirstWeekday(today));
      await createTarget(page, 'mobility', [notToday]);

      await page.goto('/dashboard/habits');
      await expect(settingsTodayBadge(page, 'walk')).toBeVisible();
      await expect(settingsTodayBadge(page, 'mobility')).toHaveCount(0);

      await page.goto('/dashboard/today');
      await expect(page.getByTestId('habit-preview-list')).toBeVisible({ timeout: 10000 });
      await expect(todayListBadge(page, 'walk')).toBeVisible();
      await expect(todayListBadge(page, 'mobility')).toHaveCount(0);

      // The negative case is not "no target": mobility is configured today, yet
      // has no elapsed expected day, so its denominator is honestly zero and the
      // history names the absence without a ratio.
      const adherence = await readAdherence(page, 'month');
      expect(adherence.configurationState).toBe('partially_configured');
      expect(adherence.perHabit.mobility.configurationState).toBe('configured');
      expect(adherence.perHabit.mobility.metricState).toBe('no_expected_days');
      expect(adherence.perHabit.mobility.expectedHabitDays).toBe(0);
      expect(adherence.perHabit.mobility.adherencePercent).toBeNull();

      await page.goto('/dashboard/habits');
      const mobilityHistory = page.getByTestId('habit-target-history-habit-mobility');
      await expect(mobilityHistory).toBeVisible();
      await expect(
        mobilityHistory.getByText('Sin días objetivo transcurridos en este período.', {
          exact: true,
        }),
      ).toBeVisible();
      await expect(mobilityHistory).not.toContainText(COUNT_LABEL_PATTERN);
      await expect(mobilityHistory).not.toContainText('%');
    });

    test('keeps prior dates on the old version when a later-day update is confirmed', async ({
      page,
    }) => {
      await registerAndCompleteTestAccount(page, 'Version Historica');
      const identity = await readSessionIdentity(page);
      const today = cordobaToday();

      // A version effective a full week before today, selecting only today's
      // weekday: exactly one prior date falls on that weekday, the rest do not.
      const seededFrom = shiftLocalDate(today, -7);
      const seededWeekday = sundayFirstWeekday(today);
      const seededId = await seedTargetSchedule({
        userId: identity.id,
        habitKey: 'mobility',
        effectiveFrom: seededFrom,
        effectiveTo: null,
        version: 3,
        weekdays: [seededWeekday],
      });
      await seedHabitLog(identity.id, seededFrom, 'mobility');

      // The real API closes the old version yesterday and starts a new all-week
      // version from today, with a fresh monotonic version on the new row.
      const update = await page.request.put('/api/habit-targets/mobility', {
        data: { weekdays: ALL_WEEKDAYS, expectedTargetId: seededId, expectedVersion: 3 },
      });
      expect(update.status(), 'the update with the seeded token must succeed').toBe(200);

      const targets = await readTargets(page);
      expect(targets, 'only one active version may remain per habit').toHaveLength(1);
      const active = targetFor(targets, 'mobility');
      expect(active.effectiveFrom).toBe(today);
      expect(active.version).toBe(1);
      expect([...active.weekdays].sort((a, b) => a - b)).toEqual([...ALL_WEEKDAYS]);

      const adherence = await readAdherence(page, 'month');
      // Old version: exactly the seeded weekday in [seededFrom, yesterday] was
      // expected and recorded. New version: today is expected, not recorded.
      expect(adherence.perHabit.mobility.expectedHabitDays).toBe(2);
      expect(adherence.perHabit.mobility.completedExpectedHabitDays).toBe(1);
      expect(dayFor(adherence, seededFrom).habitStates.mobility).toBe('expected_completed');
      expect(dayFor(adherence, shiftLocalDate(today, -6)).habitStates.mobility).toBe('not_expected');
      expect(dayFor(adherence, today).habitStates.mobility).toBe('expected_unrecorded');
      expect(adherence.expectedHabitDays).toBe(2);
      expect(adherence.completedExpectedHabitDays).toBe(1);
      expect(adherence.adherencePercent).toBe(50);
    });

    test('rejects a stale compare-and-swap token with 409 and keeps server truth', async ({
      page,
    }) => {
      await registerAndCompleteTestAccount(page, 'Token Obsoleto');
      const created = await createTarget(page, 'walk', ALL_WEEKDAYS);

      const sameDayUpdate = await page.request.put('/api/habit-targets/walk', {
        data: {
          weekdays: [0],
          expectedTargetId: created.id,
          expectedVersion: created.version,
        },
      });
      expect(sameDayUpdate.status()).toBe(200);
      const updated = (await sameDayUpdate.json()) as HabitTargetResponse;
      expect(updated.version).toBe(created.version + 1);
      expect(updated.effectiveFrom).toBe(created.effectiveFrom);
      expect(updated.weekdays).toEqual([0]);

      const stale = await page.request.put('/api/habit-targets/walk', {
        data: { weekdays: [1], expectedTargetId: created.id, expectedVersion: created.version },
      });
      expect(stale.status()).toBe(409);
      expect(await stale.json()).toMatchObject({ code: 'CONFLICT' });

      const after = targetFor(await readTargets(page), 'walk');
      expect(after).toEqual(updated);
    });
  });

  test.describe('Adherence contract', () => {
    test('counts an expected-unrecorded day in the denominator without the numerator', async ({
      page,
    }) => {
      await registerAndCompleteTestAccount(page, 'Denominador');
      await createTarget(page, 'walk', ALL_WEEKDAYS);
      const today = cordobaToday();

      const adherence = await readAdherence(page, 'month');
      expect(adherence.metricState).toBe('result');
      expect(adherence.expectedHabitDays).toBe(1);
      expect(adherence.completedExpectedHabitDays).toBe(0);
      expect(adherence.extraRecordedHabitDays).toBe(0);
      expect(adherence.adherencePercent).toBe(0);
      expect(dayFor(adherence, today).habitStates.walk).toBe('expected_unrecorded');
      expect(adherence.perHabit.walk.metricState).toBe('result');
      expect(adherence.perHabit.walk.expectedHabitDays).toBe(1);
      expect(adherence.perHabit.walk.completedExpectedHabitDays).toBe(0);

      // The Progress card pairs the counts with the derived percent, never a bare ratio.
      await page.goto('/dashboard/progress');
      await expect(progressAdherenceResult(page)).toBeVisible();
      await expect(
        progressAdherenceResult(page).getByText(PROGRESS_TARGET_COPY.resultLabel(0, 1)),
      ).toBeVisible();
      await expect(
        progressAdherenceResult(page).getByText(PROGRESS_TARGET_COPY.percentLabel(0)),
      ).toBeVisible();
      await expect(
        progressAdherenceResult(page).getByText(PROGRESS_TARGET_COPY.provenance, { exact: true }),
      ).toBeVisible();
    });

    test('keeps an extra non-expected record out of the ratio but visible as activity', async ({
      page,
    }) => {
      await registerAndCompleteTestAccount(page, 'Registro Extra');
      await createTarget(page, 'walk', ALL_WEEKDAYS);

      // `sleep` has no target: recording it today can only be extra activity.
      await page.goto('/dashboard/habits');
      await toggleHabit(page, 'sleep');

      const adherence = await readAdherence(page, 'month');
      expect(adherence.expectedHabitDays).toBe(1);
      expect(adherence.completedExpectedHabitDays).toBe(0);
      expect(adherence.extraRecordedHabitDays).toBe(1);
      expect(adherence.perHabit.sleep.extraRecordedHabitDays).toBe(1);
      expect(adherence.perHabit.sleep.expectedHabitDays).toBe(0);
      expect(adherence.perHabit.sleep.metricState).toBe('no_expected_days');
      expect(dayFor(adherence, cordobaToday()).habitStates.sleep).toBe('extra_recorded');

      // The observed-activity contract still sees the same record (v0.9 intact).
      const activityResponse = await page.request.get('/api/stats/habits?period=week');
      expect(activityResponse.status()).toBe(200);
      const activity = (await activityResponse.json()) as {
        activeDays: number;
        perHabit: Record<HabitKey, { activeDays: number }>;
      };
      expect(activity.perHabit.sleep.activeDays).toBe(1);
      expect(activity.activeDays).toBe(1);

      // The Progress card names the extra record as outside the objective and
      // keeps the numerator/denominator unchanged.
      await page.goto('/dashboard/progress');
      await expect(
        progressAdherenceResult(page).getByText(PROGRESS_TARGET_COPY.resultLabel(0, 1)),
      ).toBeVisible();
      await expect(
        progressAdherenceResult(page).getByText(PROGRESS_TARGET_COPY.extraLabel(1), {
          exact: true,
        }),
      ).toBeVisible();
    });

    test('reports not_configured / no_expected_days with no ratio and no percent', async ({
      page,
    }) => {
      await registerAndCompleteTestAccount(page, 'Sin Objetivo');
      expect(await readTargets(page)).toEqual([]);

      const adherence = await readAdherence(page, 'month');
      expect(adherence.configurationState).toBe('not_configured');
      expect(adherence.metricState).toBe('no_expected_days');
      expect(adherence.expectedHabitDays).toBe(0);
      expect(adherence.completedExpectedHabitDays).toBe(0);
      expect(adherence.extraRecordedHabitDays).toBe(0);
      expect(adherence.adherencePercent).toBeNull();
      for (const key of Object.keys(HABIT_KEY_NAMES) as HabitKey[]) {
        const habit: HabitTargetHabitAdherence = adherence.perHabit[key];
        expect(habit.configurationState).toBe('not_configured');
        expect(habit.metricState).toBe('no_expected_days');
        expect(habit.adherencePercent).toBeNull();
      }

      await page.goto('/dashboard/progress');
      await expect(progressAdherenceEmpty(page)).toBeVisible();
      await expect(progressAdherenceResult(page)).toHaveCount(0);
      await expect(progressAdherenceEmpty(page)).not.toContainText('%');
      await expect(page.getByText(COUNT_LABEL_PATTERN)).toHaveCount(0);

      await page.goto('/dashboard/habits');
      await expect(page.getByTestId('habit-target-history-empty')).toBeVisible();
      await expect(
        page.getByText(TARGET_COPY.historyEmpty, { exact: true }),
      ).toBeVisible();
    });

    test('shows N de M with percent and provenance on the Progress card', async ({ page }) => {
      await registerAndCompleteTestAccount(page, 'Cumplimiento');
      await createTarget(page, 'walk', ALL_WEEKDAYS);
      await page.goto('/dashboard/habits');
      await toggleHabit(page, 'walk');

      const adherence = await readAdherence(page, 'month');
      expect(adherence.expectedHabitDays).toBe(1);
      expect(adherence.completedExpectedHabitDays).toBe(1);
      expect(adherence.adherencePercent).toBe(100);

      await page.goto('/dashboard/progress');
      const result = progressAdherenceResult(page);
      await expect(result).toBeVisible();
      await expect(
        result.getByText(PROGRESS_TARGET_COPY.resultLabel(1, 1)),
      ).toBeVisible();
      await expect(
        result.getByText(PROGRESS_TARGET_COPY.percentLabel(100)),
      ).toBeVisible();
      await expect(
        result.getByText(PROGRESS_TARGET_COPY.provenance, { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(
          PROGRESS_TARGET_COPY.windowLabel(
            displayDate(adherence.windowStart),
            displayDate(adherence.windowEnd),
          ),
          { exact: true },
        ),
      ).toBeVisible();
    });
  });

  test.describe('Cross-user isolation', () => {
    test('user B cannot read or mutate user A targets', async ({ page, browser }) => {
      await registerAndCompleteTestAccount(page, 'Aislamiento A');
      const targetA = await createTarget(page, 'walk', ALL_WEEKDAYS);
      const identityA = await readSessionIdentity(page);

      const contextB = await browser.newContext();
      try {
        const pageB = await contextB.newPage();
        await registerAndCompleteTestAccount(pageB, 'Aislamiento B');

        // B cannot read A's target: its own catalog is empty.
        expect(await readTargets(pageB)).toEqual([]);

        // B cannot update using A's token: the token has no active target in B.
        const updateAsB = await contextB.request.put('/api/habit-targets/walk', {
          data: {
            weekdays: [1],
            expectedTargetId: targetA.id,
            expectedVersion: targetA.version,
          },
        });
        expect(updateAsB.status()).toBe(409);
        expect(await updateAsB.json()).toMatchObject({ code: 'CONFLICT' });

        // B cannot delete using A's token either; it stays idempotently absent.
        const deleteAsB = await contextB.request.delete('/api/habit-targets/walk', {
          data: { expectedTargetId: targetA.id, expectedVersion: targetA.version },
        });
        expect(deleteAsB.status()).toBe(200);
        expect(await deleteAsB.json()).toEqual({ activeTarget: null });

        // B has no expected days regardless.
        const adherenceB = await readAdherence(pageB, 'month');
        expect(adherenceB.configurationState).toBe('not_configured');
        expect(adherenceB.metricState).toBe('no_expected_days');
        expect(adherenceB.expectedHabitDays).toBe(0);

        // A's target is untouched.
        const targetAAfter = targetFor(await readTargets(page), 'walk');
        expect(targetAAfter.id).toBe(targetA.id);
        expect(targetAAfter.version).toBe(targetA.version);
        expect(targetAAfter.weekdays).toEqual(targetA.weekdays);
        expect(identityA.id).toBeGreaterThan(0);
      } finally {
        await contextB.close();
      }
    });

    test('requires an authenticated session on every target endpoint', async ({ browser }) => {
      const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      try {
        const getTargets = await anonymous.request.get('/api/habit-targets');
        expect(getTargets.status()).toBe(401);
        expect(await getTargets.json()).toMatchObject({
          code: 'UNAUTHORIZED',
          message: 'Autenticación requerida',
        });

        const putTarget = await anonymous.request.put('/api/habit-targets/walk', {
          data: { weekdays: [1], expectedTargetId: null, expectedVersion: null },
        });
        expect(putTarget.status()).toBe(401);

        const adherence = await anonymous.request.get('/api/stats/habit-adherence?period=month');
        expect(adherence.status()).toBe(401);
      } finally {
        await anonymous.close();
      }
    });
  });

  test.describe('Progress honesty', () => {
    test('shows a real decimal volume for an eligible session and unavailable only otherwise', async ({
      page,
    }) => {
      await registerAndCompleteTestAccount(page, 'Volumen Real');

      const exercisesResponse = await page.request.get('/api/exercises');
      expect(exercisesResponse.status()).toBe(200);
      const exercises = (await exercisesResponse.json()) as Array<{ id: number }>;
      expect(exercises.length, 'the catalog must expose at least one exercise').toBeGreaterThan(0);
      const exerciseId = exercises[0].id;

      // Session with an eligible set: 50.55 kg × 3 = 151.65 kg.
      const withSetsResponse = await page.request.post('/api/workouts', { data: {} });
      expect(withSetsResponse.status()).toBe(201);
      const withSets = (await withSetsResponse.json()) as { id: number };
      const setResponse = await page.request.post(`/api/workouts/${withSets.id}/sets`, {
        data: { exerciseId, setIndex: 1, reps: 3, weightKg: '50.55' },
      });
      expect(setResponse.status()).toBe(201);
      const closeWithSets = await page.request.patch(`/api/workouts/${withSets.id}`, {
        data: { endedAt: new Date().toISOString() },
      });
      expect(closeWithSets.status()).toBe(200);

      // Session with no eligible sets: volume must stay genuinely unavailable.
      const withoutSetsResponse = await page.request.post('/api/workouts', { data: {} });
      expect(withoutSetsResponse.status()).toBe(201);
      const withoutSets = (await withoutSetsResponse.json()) as { id: number };
      const closeWithoutSets = await page.request.patch(`/api/workouts/${withoutSets.id}`, {
        data: { endedAt: new Date().toISOString() },
      });
      expect(closeWithoutSets.status()).toBe(200);

      const summaryResponse = await page.request.get('/api/progress/summary?period=month');
      expect(summaryResponse.status()).toBe(200);
      const summary = (await summaryResponse.json()) as {
        sessions: Array<{ workoutId: number; totalVolumeKg: string | null }>;
      };
      const withSetsSummary = summary.sessions.find((s) => s.workoutId === withSets.id);
      const withoutSetsSummary = summary.sessions.find((s) => s.workoutId === withoutSets.id);
      expect(withSetsSummary?.totalVolumeKg).toBe('151.65');
      expect(withoutSetsSummary?.totalVolumeKg).toBeNull();

      await page.goto('/dashboard/progress');
      await expect(page.getByText('151.65 kg', { exact: true })).toBeVisible();
      await expect(page.getByText('Volumen no disponible', { exact: true })).toBeVisible();
    });

    test('removes the inert Notificaciones and Compartir controls from the Progress header', async ({
      page,
    }) => {
      await registerAndCompleteTestAccount(page, 'Header Honesto');
      await page.goto('/dashboard/progress');
      await expect(page.getByRole('heading', { name: 'Progreso', exact: true })).toBeVisible();

      // The global app shell keeps its own notification affordance; the removed
      // controls lived in the Progress page header, which is the one owning `Progreso`.
      const progressHeader = page
        .locator('header')
        .filter({ has: page.getByRole('heading', { name: 'Progreso', exact: true }) });
      await expect(progressHeader).toBeVisible();
      await expect(
        progressHeader.getByRole('button', { name: 'Notificaciones', exact: true }),
      ).toHaveCount(0);
      await expect(
        progressHeader.getByRole('button', { name: 'Compartir progreso', exact: true }),
      ).toHaveCount(0);
      await expect(
        progressHeader.getByRole('button', { name: 'Compartir', exact: true }),
      ).toHaveCount(0);
    });
  });

  test.describe('Mobile golden path', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('configures, records and reads back the objective loop without overflow', async ({
      page,
    }) => {
      await registerAndCompleteTestAccount(page, 'Objetivo Mobile');
      await page.goto('/dashboard/habits');

      await selectAllWeekdaysFor(page, HABIT_KEY_NAMES.walk);
      const writePromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/habit-targets/walk') &&
          response.request().method() === 'PUT' &&
          response.status() === 201,
      );
      await targetRow(page, 'walk')
        .getByRole('button', { name: TARGET_COPY.save, exact: true })
        .click();
      expect((await writePromise).status()).toBe(201);
      await expect(settingsTodayBadge(page, 'walk')).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await toggleHabit(page, 'walk');
      await expect(page.getByText('1 de 4 completados', { exact: true })).toBeVisible();

      const adherence = await readAdherence(page, 'month');
      expect(adherence.completedExpectedHabitDays).toBe(1);
      expect(adherence.expectedHabitDays).toBe(1);

      await page.goto('/dashboard/progress');
      await expect(progressAdherenceResult(page)).toBeVisible();
      await expect(
        progressAdherenceResult(page).getByText(PROGRESS_TARGET_COPY.resultLabel(1, 1)),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  });
});
