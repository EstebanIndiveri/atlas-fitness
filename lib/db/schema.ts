import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

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
 * Workouts table — training sessions
 */
export const workouts = sqliteTable('workouts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
  note: text('note'),
  mood: integer('mood'),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

/**
 * Workout sets table — individual sets within workouts
 * weight_kg stored as text to preserve decimal precision
 */
export const workoutSets = sqliteTable('workout_sets', {
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
});

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
 * User streaks table — workout streak tracking
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

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Exercise = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;

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
