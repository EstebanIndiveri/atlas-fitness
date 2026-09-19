import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

/**
 * Users table — authentication and profile
 */
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  telegramUserId: text('telegram_user_id').unique(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Auth sessions — HMAC cookie revocation store (ADR-004).
 * Distinct from guided workout sessions (ADR-003).
 */
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    revokedAt: integer('revoked_at', { mode: 'timestamp' }),
  },
  (table) => ({
    userIdIdx: index('sessions_user_id_idx').on(table.userId),
  }),
);

/**
 * Auth rate-limit buckets — durable fixed-window counters (P1.3).
 * Key is `action:ip` (login|register). Not process memory: serverless-safe.
 */
export const rateLimitBuckets = sqliteTable('rate_limit_buckets', {
  key: text('key').primaryKey(),
  windowStart: integer('window_start').notNull(),
  count: integer('count').notNull(),
});

/**
 * Exercises table — system and user-custom exercises
 */
export const exercises = sqliteTable('exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  muscleGroup: text('muscle_group').notNull(),
  instructions: text('instructions').notNull(),
  imageUrl: text('image_url'),
  videoUrl: text('video_url'),
  isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
  userId: integer('user_id').references(() => users.id),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

/**
 * Routines table — system seed and user-custom templates for guided sessions.
 */
export const routines = sqliteTable('routines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  kind: text('kind').notNull().default('gym'),
  restSeconds: integer('rest_seconds').notNull().default(90),
  isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(true),
  userId: integer('user_id').references(() => users.id),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

/**
 * Routine exercises — ordered target sets/reps for a routine.
 */
export const routineExercises = sqliteTable(
  'routine_exercises',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    routineId: integer('routine_id')
      .notNull()
      .references(() => routines.id),
    exerciseId: integer('exercise_id')
      .notNull()
      .references(() => exercises.id),
    sortOrder: integer('sort_order').notNull(),
    targetSets: integer('target_sets').notNull(),
    targetReps: integer('target_reps').notNull(),
  },
  (table) => ({
    uniqueRoutineOrder: uniqueIndex('routine_exercises_routine_id_sort_order_unique').on(
      table.routineId,
      table.sortOrder,
    ),
  }),
);

/**
 * Workouts table — training sessions
 */
export const workouts = sqliteTable(
  'workouts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    routineId: integer('routine_id').references(() => routines.id),
    startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
    endedAt: integer('ended_at', { mode: 'timestamp' }),
    note: text('note'),
    mood: integer('mood'),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (table) => ({
    uniqueActiveWorkout: uniqueIndex('workouts_user_id_active_unique')
      .on(table.userId)
      .where(sql`${table.endedAt} IS NULL AND ${table.deletedAt} IS NULL`),
  }),
);

/**
 * Workout sets table — individual sets within workouts
 * weight_kg stored as text to preserve decimal precision
 */
export const workoutSets = sqliteTable(
  'workout_sets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    workoutId: integer('workout_id')
      .notNull()
      .references(() => workouts.id),
    exerciseId: integer('exercise_id')
      .notNull()
      .references(() => exercises.id),
    setIndex: integer('set_index').notNull(),
    reps: integer('reps').notNull(),
    weightKg: text('weight_kg').notNull(),
    completed: integer('completed', { mode: 'boolean' }).notNull().default(true),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (table) => ({
    uniqueWorkoutSet: uniqueIndex('workout_sets_workout_id_set_index_unique')
      .on(table.workoutId, table.setIndex)
      .where(sql`${table.deletedAt} IS NULL`),
  })
);

/**
 * Daily tips table — motivational tips for users
 */
export const dailyTips = sqliteTable('daily_tips', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(),
  body: text('body').notNull(),
  source: text('source').notNull(),
});

/**
 * Telegram link codes table — short-lived codes for linking Telegram accounts
 */
export const telegramLinkCodes = sqliteTable('telegram_link_codes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  code: text('code').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  used: integer('used', { mode: 'boolean' }).notNull().default(false),
});

/**
 * Bot messages table — idempotency for Telegram webhook
 */
export const botMessages = sqliteTable('bot_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  telegramUpdateId: text('telegram_update_id').notNull().unique(),
  userId: integer('user_id').references(() => users.id),
  rawRequest: text('raw_request').notNull(),
  response: text('response'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * User streaks table — consecutive active-day tracking (TZ Córdoba).
 *
 * `last_workout_date` is reused as the last **active** day (YYYY-MM-DD in
 * America/Argentina/Cordoba), even when that day was mood-only (no workout).
 * Renaming the column is avoided to prevent migration churn.
 */
export const userStreaks = sqliteTable('user_streaks', {
  userId: integer('user_id')
    .primaryKey()
    .references(() => users.id),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  lastWorkoutDate: text('last_workout_date'),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Daily checkins table — mood tracking separate from tips
 * One checkin per user per local date (America/Argentina/Cordoba)
 */
export const dailyCheckins = sqliteTable(
  'daily_checkins',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    localDate: text('local_date').notNull(),
    mood: integer('mood').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    uniqueUserDate: uniqueIndex('daily_checkins_user_id_local_date_unique').on(
      table.userId,
      table.localDate
    ),
  })
);

/**
 * Streak nudges table — idempotent log of "streak at risk" intents.
 * Unique (user_id, local_date, kind) so the same-day cron cannot duplicate.
 * Telegram delivery is out of scope; this stores intent / audit only.
 */
export const streakNudges = sqliteTable(
  'streak_nudges',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    localDate: text('local_date').notNull(),
    kind: text('kind').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    uniqueUserDateKind: uniqueIndex('streak_nudges_user_id_local_date_kind_unique').on(
      table.userId,
      table.localDate,
      table.kind
    ),
  })
);

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;

export type RateLimitBucket = typeof rateLimitBuckets.$inferSelect;
export type NewRateLimitBucket = typeof rateLimitBuckets.$inferInsert;

export type Exercise = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;

export type Routine = typeof routines.$inferSelect;
export type NewRoutine = typeof routines.$inferInsert;

export type RoutineExercise = typeof routineExercises.$inferSelect;
export type NewRoutineExercise = typeof routineExercises.$inferInsert;

export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;

export type WorkoutSet = typeof workoutSets.$inferSelect;
export type NewWorkoutSet = typeof workoutSets.$inferInsert;

export type DailyTip = typeof dailyTips.$inferSelect;
export type NewDailyTip = typeof dailyTips.$inferInsert;

export type TelegramLinkCode = typeof telegramLinkCodes.$inferSelect;
export type NewTelegramLinkCode = typeof telegramLinkCodes.$inferInsert;

export type BotMessage = typeof botMessages.$inferSelect;
export type NewBotMessage = typeof botMessages.$inferInsert;

export type UserStreak = typeof userStreaks.$inferSelect;
export type NewUserStreak = typeof userStreaks.$inferInsert;

export type DailyCheckin = typeof dailyCheckins.$inferSelect;
export type NewDailyCheckin = typeof dailyCheckins.$inferInsert;

export type StreakNudge = typeof streakNudges.$inferSelect;
export type NewStreakNudge = typeof streakNudges.$inferInsert;
