import { sql } from 'drizzle-orm';
import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
  check,
  primaryKey,
} from 'drizzle-orm/sqlite-core';
import type {
  UserEquipmentPreference,
  UserGoalPreference,
  UserPacePreference,
} from '@/types/user-preferences';
import type {
  AmountBasis,
  LoadMode,
  RepCountBasis,
  SetPurpose,
  Side,
} from '@/types/progression';

/**
 * Users table — authentication and profile
 */
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  telegramUserId: text('telegram_user_id').unique(),
  onboardingCompletedAt: integer('onboarding_completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Explicitly selected onboarding preferences, kept separate from training plans.
 */
export const userPreferences = sqliteTable(
  'user_preferences',
  {
    userId: integer('user_id')
      .primaryKey()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    goal: text('goal').$type<UserGoalPreference>(),
    pace: text('pace').$type<UserPacePreference>(),
    equipment: text('equipment').$type<UserEquipmentPreference>(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    goalValue: check(
      'user_preferences_goal_check',
      sql`${table.goal} IS NULL OR ${table.goal} IN ('muscle', 'strength', 'fitness', 'consistency', 'wellbeing')`,
    ),
    paceValue: check(
      'user_preferences_pace_check',
      sql`${table.pace} IS NULL OR ${table.pace} IN ('days-2', 'days-3', 'days-4', 'days-5')`,
    ),
    equipmentValue: check(
      'user_preferences_equipment_check',
      sql`${table.equipment} IS NULL OR ${table.equipment} IN ('gym', 'dumbbells', 'bodyweight', 'bands')`,
    ),
  }),
);

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
export const routines = sqliteTable(
  'routines',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    kind: text('kind').notNull().default('gym'),
    restSeconds: integer('rest_seconds').notNull().default(90),
    isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(true),
    userId: integer('user_id').references(() => users.id),
    trainingPlanId: integer('training_plan_id').references(() => trainingPlans.id),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (table) => ({
    trainingPlanIdIdx: index('routines_training_plan_id_idx').on(table.trainingPlanId),
  }),
);

/**
 * Training plans — V1 simple weekly routine schedule.
 * `day_of_week` in scheduled_routines uses 0=Sunday, 1=Monday, ..., 6=Saturday.
 */
export const trainingPlans = sqliteTable(
  'training_plans',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    goal: text('goal'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (table) => ({
    uniqueActiveUserPlan: uniqueIndex('training_plans_user_id_active_unique')
      .on(table.userId)
      .where(sql`${table.isActive} = 1 AND ${table.deletedAt} IS NULL`),
  }),
);

/**
 * Guided plan save idempotency keys, committed atomically with their plan.
 */
export const guidedTrainingPlanSaves = sqliteTable(
  'guided_training_plan_saves',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    clientMutationId: text('client_mutation_id').notNull(),
    payloadHash: text('payload_hash').notNull(),
    trainingPlanId: integer('training_plan_id').references(() => trainingPlans.id),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    uniqueUserMutation: uniqueIndex('guided_training_plan_saves_user_mutation_unique').on(
      table.userId,
      table.clientMutationId,
    ),
  }),
);

export const scheduledRoutines = sqliteTable(
  'scheduled_routines',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    trainingPlanId: integer('training_plan_id')
      .notNull()
      .references(() => trainingPlans.id),
    dayOfWeek: integer('day_of_week').notNull(),
    routineId: integer('routine_id')
      .notNull()
      .references(() => routines.id),
    note: text('note'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    uniquePlanDay: uniqueIndex('scheduled_routines_plan_day_unique').on(
      table.trainingPlanId,
      table.dayOfWeek,
    ),
    dayOfWeekRange: check(
      'scheduled_routines_day_of_week_check',
      sql`${table.dayOfWeek} BETWEEN 0 AND 6`,
    ),
  }),
);

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
    queueJson: text('queue_json'),
    queueVersion: integer('queue_version').notNull().default(0),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (table) => ({
    uniqueActiveWorkout: uniqueIndex('workouts_user_id_active_unique')
      .on(table.userId)
      .where(sql`${table.endedAt} IS NULL AND ${table.deletedAt} IS NULL`),
    // Additive partial index (v0.11) that orders a user's completed workouts by the
    // canonical `ended_at DESC, id DESC` without a full-history sort. It changes no
    // existing column, row or workout semantic.
    userEndedIdx: index('workouts_user_id_ended_at_idx')
      .on(table.userId, sql`${table.endedAt} DESC`, sql`${table.id} DESC`)
      .where(sql`${table.deletedAt} IS NULL AND ${table.endedAt} IS NOT NULL`),
  }),
);

/**
 * Post-workout feedback — explicit user input collected after a completed workout.
 */
export const postWorkoutFeedback = sqliteTable(
  'post_workout_feedback',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    workoutId: integer('workout_id')
      .notNull()
      .references(() => workouts.id),
    localDate: text('local_date').notNull(),
    effort: integer('effort').notNull(),
    sensation: text('sensation').notNull(),
    discomfortJson: text('discomfort_json').notNull(),
    note: text('note'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    uniqueWorkoutFeedback: uniqueIndex('post_workout_feedback_workout_id_unique').on(
      table.workoutId,
    ),
    userDateIdx: index('post_workout_feedback_user_local_date_idx').on(
      table.userId,
      table.localDate,
    ),
    effortRange: check('post_workout_feedback_effort_check', sql`${table.effort} BETWEEN 1 AND 10`),
    sensationValue: check(
      'post_workout_feedback_sensation_check',
      sql`${table.sensation} IN ('great', 'good', 'neutral', 'hard', 'bad')`,
    ),
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
    // Nullable semantic capture (v0.12). Legacy rows keep all six NULL and remain
    // raw/uninterpreted; there is deliberately no second amount column.
    semanticCaptureVersion: integer('semantic_capture_version'),
    loadMode: text('load_mode').$type<LoadMode>(),
    amountBasis: text('amount_basis').$type<AmountBasis>(),
    side: text('side').$type<Side>(),
    setPurpose: text('set_purpose').$type<SetPurpose>(),
    repCountBasis: text('rep_count_basis').$type<RepCountBasis>(),
  },
  (table) => ({
    uniqueWorkoutSet: uniqueIndex('workout_sets_workout_id_set_index_unique')
      .on(table.workoutId, table.setIndex)
      .where(sql`${table.deletedAt} IS NULL`),
    // Additive partial index (v0.11) for the bounded "last completed sets" lookup:
    // exact exercise across the user's completed workouts. It changes no existing
    // column, row or set semantic.
    exerciseLookupIdx: index('workout_sets_exercise_lookup_idx')
      .on(table.exerciseId, table.workoutId, table.setIndex, table.id)
      .where(sql`${table.deletedAt} IS NULL AND ${table.completed} = 1`),
    // Additive partial expression index (v0.12) for the exact all-time external-load
    // cohort lookup. It orders by decimal-exact `weight_kg` (integer-part length,
    // integer part, fractional part) for a fixed exercise/mode/basis/side/reps key.
    externalPrCohortIdx: index('workout_sets_external_pr_cohort_idx')
      .on(
        table.exerciseId,
        table.loadMode,
        table.amountBasis,
        table.side,
        table.reps,
        sql`(length(CASE WHEN instr(${table.weightKg}, '.') = 0 THEN ${table.weightKg} ELSE substr(${table.weightKg}, 1, instr(${table.weightKg}, '.') - 1) END)) DESC`,
        sql`(CASE WHEN instr(${table.weightKg}, '.') = 0 THEN ${table.weightKg} ELSE substr(${table.weightKg}, 1, instr(${table.weightKg}, '.') - 1) END) DESC`,
        sql`(CASE WHEN instr(${table.weightKg}, '.') = 0 THEN '' ELSE substr(${table.weightKg}, instr(${table.weightKg}, '.') + 1) END) DESC`,
      )
      .where(sql`${table.deletedAt} IS NULL AND ${table.completed} = 1`),
    semanticCaptureVersionValue: check(
      'workout_sets_semantic_capture_version_check',
      sql`${table.semanticCaptureVersion} IS NULL OR ${table.semanticCaptureVersion} > 0`,
    ),
    loadModeValue: check(
      'workout_sets_load_mode_check',
      sql`${table.loadMode} IS NULL OR ${table.loadMode} IN ('external', 'bodyweight', 'bodyweight_added', 'assisted')`,
    ),
    amountBasisValue: check(
      'workout_sets_amount_basis_check',
      sql`${table.amountBasis} IS NULL OR ${table.amountBasis} IN ('total', 'per_side')`,
    ),
    sideValue: check(
      'workout_sets_side_check',
      sql`${table.side} IS NULL OR ${table.side} IN ('bilateral', 'left', 'right', 'alternating')`,
    ),
    setPurposeValue: check(
      'workout_sets_set_purpose_check',
      sql`${table.setPurpose} IS NULL OR ${table.setPurpose} IN ('working', 'warmup')`,
    ),
    repCountBasisValue: check(
      'workout_sets_rep_count_basis_check',
      sql`${table.repCountBasis} IS NULL OR ${table.repCountBasis} IN ('total', 'per_side')`,
    ),
    // All six semantics NULL (legacy/unknown) or the four required v1 fields present.
    semanticTupleComplete: check(
      'workout_sets_semantic_tuple_check',
      sql`(${table.semanticCaptureVersion} IS NULL AND ${table.loadMode} IS NULL AND ${table.amountBasis} IS NULL AND ${table.side} IS NULL AND ${table.setPurpose} IS NULL AND ${table.repCountBasis} IS NULL) OR (${table.semanticCaptureVersion} IS NOT NULL AND ${table.loadMode} IS NOT NULL AND ${table.side} IS NOT NULL AND ${table.setPurpose} IS NOT NULL)`,
    ),
    // Plain bodyweight carries no basis and the canonical zero sentinel; every other
    // load mode carries an explicit amount basis.
    bodyweightAmount: check(
      'workout_sets_bodyweight_amount_check',
      sql`${table.loadMode} IS NULL OR (${table.loadMode} = 'bodyweight' AND ${table.amountBasis} IS NULL AND ${table.weightKg} = '0') OR (${table.loadMode} <> 'bodyweight' AND ${table.amountBasis} IS NOT NULL)`,
    ),
    // Alternating requires an explicit rep-count basis; every other side forbids it.
    alternatingRepBasis: check(
      'workout_sets_alternating_rep_basis_check',
      sql`${table.side} IS NULL OR (${table.side} = 'alternating' AND ${table.repCountBasis} IS NOT NULL) OR (${table.side} <> 'alternating' AND ${table.repCountBasis} IS NULL)`,
    ),
  })
);

/**
 * Per-workout, per-exercise user notes — the explicit exercise-session memory (v0.11).
 *
 * One row per `(workout_id, exercise_id)`; `version` is the monotonic compare-and-swap
 * token and is never a timestamp. Rows are hard-deleted on explicit user DELETE and are
 * never fabricated by Atlas. `user_id` mirrors the workout owner as defense in depth and
 * is never accepted from a request body.
 */
export const workoutExerciseNotes = sqliteTable(
  'workout_exercise_notes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    workoutId: integer('workout_id')
      .notNull()
      .references(() => workouts.id),
    exerciseId: integer('exercise_id')
      .notNull()
      .references(() => exercises.id),
    note: text('note').notNull(),
    version: integer('version').notNull().default(1),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => ({
    uniqueWorkoutExercise: uniqueIndex('workout_exercise_notes_workout_exercise_unique').on(
      table.workoutId,
      table.exerciseId,
    ),
    userExerciseUpdatedIdx: index('workout_exercise_notes_user_exercise_updated_idx').on(
      table.userId,
      table.exerciseId,
      table.updatedAt,
    ),
    versionValue: check('workout_exercise_notes_version_check', sql`${table.version} >= 1`),
  }),
);

/**
 * Skip/hold idempotency — one row per workout + action + clientMutationId.
 */
export const workoutQueueMutations = sqliteTable(
  'workout_queue_mutations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    workoutId: integer('workout_id')
      .notNull()
      .references(() => workouts.id),
    action: text('action').notNull(),
    clientMutationId: text('client_mutation_id').notNull(),
    exerciseId: integer('exercise_id').notNull(),
    responseJson: text('response_json').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    uniqueMutation: uniqueIndex('workout_queue_mutations_workout_action_client_unique').on(
      table.workoutId,
      table.action,
      table.clientMutationId,
    ),
  }),
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
 * Daily checkins table — explicit mood/energy tracking separate from tips
 * One checkin per user per local date (America/Argentina/Cordoba)
 * `energy` is nullable for legacy mood-only rows; do not backfill defaults.
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
    energy: text('energy'),
    note: text('note'),
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
    energyValue: check(
      'daily_checkins_energy_value_check',
      sql`${table.energy} IS NULL OR ${table.energy} IN ('low', 'medium', 'high')`
    ),
  })
);

/**
 * Coach recommendations — traceable adaptation previews and user decisions.
 *
 * Idempotency key: `workout_id + result_json`. The same generated recommendation
 * for the same workout returns the existing row, so decision transitions are never
 * reset; a future materially different generation for the workout can be stored separately.
 */
export const coachRecommendations = sqliteTable(
  'coach_recommendations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    workoutId: integer('workout_id')
      .notNull()
      .references(() => workouts.id),
    dailyCheckInId: integer('daily_checkin_id').references(() => dailyCheckins.id),
    contextSnapshotJson: text('context_snapshot_json'),
    source: text('source').notNull(),
    resultJson: text('result_json').notNull(),
    decision: text('decision').notNull().default('pending'),
    decidedAt: integer('decided_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    uniqueWorkoutResult: uniqueIndex('coach_recommendations_workout_result_unique').on(
      table.workoutId,
      table.resultJson,
    ),
    userWorkoutIdx: index('coach_recommendations_user_workout_idx').on(
      table.userId,
      table.workoutId,
    ),
    sourceValue: check(
      'coach_recommendations_source_check',
      sql`${table.source} IN ('ai', 'deterministic')`,
    ),
    decisionValue: check(
      'coach_recommendations_decision_check',
      sql`${table.decision} IN ('pending', 'accepted', 'rejected')`,
    ),
  }),
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

/**
 * Habit logs — one row per user, per Córdoba local date, per habit.
 *
 * Every row is inherently `source: user_input` (a manual completion toggle, plus
 * an optional user-entered quantitative `amount` such as hydration liters as a
 * decimal string); no targets, ratios, or progress percentages are fabricated
 * (DATA HONESTY RULE).
 * Unique (user_id, local_date, habit_key) so daily toggles upsert idempotently.
 */
export const habitLogs = sqliteTable(
  'habit_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    localDate: text('local_date').notNull(),
    habitKey: text('habit_key').notNull(),
    done: integer('done', { mode: 'boolean' }).notNull().default(true),
    amount: text('amount'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    uniqueUserDateHabit: uniqueIndex('habit_logs_user_id_local_date_habit_key_unique').on(
      table.userId,
      table.localDate,
      table.habitKey
    ),
    userDateIdx: index('habit_logs_user_id_local_date_idx').on(table.userId, table.localDate),
    habitKeyValue: check(
      'habit_logs_habit_key_check',
      sql`${table.habitKey} IN ('hydration', 'walk', 'mobility', 'sleep')`
    ),
  })
);

/**
 * Habit target schedule versions — the user's explicit weekly intention for one
 * catalog habit, versioned by inclusive Córdoba effective dates (v0.10 §6/§9).
 *
 * `effective_to IS NULL` marks the single active version per `(user_id, habit_key)`;
 * the partial unique index enforces that at the storage level. A change closes the
 * previous version the day before and inserts a new row from today, so earlier dates
 * stay immutable. `version` is the monotonic compare-and-swap token of the row and is
 * incremented atomically on every mutation; timestamps are never a concurrency token.
 */
export const habitTargetSchedules = sqliteTable(
  'habit_target_schedules',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    habitKey: text('habit_key').notNull(),
    effectiveFrom: text('effective_from').notNull(),
    effectiveTo: text('effective_to'),
    version: integer('version').notNull().default(1),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => ({
    uniqueActiveSchedule: uniqueIndex('habit_target_schedules_active_unique')
      .on(table.userId, table.habitKey)
      .where(sql`${table.effectiveTo} IS NULL`),
    uniqueUserHabitEffectiveFrom: uniqueIndex(
      'habit_target_schedules_user_habit_effective_from_unique'
    ).on(table.userId, table.habitKey, table.effectiveFrom),
    userEffectiveRangeIdx: index('habit_target_schedules_user_effective_range_idx').on(
      table.userId,
      table.effectiveFrom,
      table.effectiveTo
    ),
    habitKeyValue: check(
      'habit_target_schedules_habit_key_check',
      sql`${table.habitKey} IN ('hydration', 'walk', 'mobility', 'sleep')`
    ),
    versionValue: check('habit_target_schedules_version_check', sql`${table.version} >= 1`),
    effectiveRange: check(
      'habit_target_schedules_effective_range_check',
      sql`${table.effectiveTo} IS NULL OR ${table.effectiveTo} >= ${table.effectiveFrom}`
    ),
  })
);

/**
 * Selected weekdays of one habit target schedule version.
 *
 * Sunday-first `0 = Sunday … 6 = Saturday`, matching training plans. The composite
 * primary key makes duplicate weekdays impossible, and the check keeps every value
 * in range. Days cascade from their owning schedule version.
 */
export const habitTargetDays = sqliteTable(
  'habit_target_days',
  {
    scheduleId: integer('schedule_id')
      .notNull()
      .references(() => habitTargetSchedules.id, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull(),
  },
  (table) => ({
    compositePrimaryKey: primaryKey({ columns: [table.scheduleId, table.dayOfWeek] }),
    dayOfWeekRange: check(
      'habit_target_days_day_of_week_check',
      sql`${table.dayOfWeek} BETWEEN 0 AND 6`
    ),
  })
);

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserPreferencesRow = typeof userPreferences.$inferSelect;
export type NewUserPreferencesRow = typeof userPreferences.$inferInsert;
export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;

export type RateLimitBucket = typeof rateLimitBuckets.$inferSelect;
export type NewRateLimitBucket = typeof rateLimitBuckets.$inferInsert;

export type Exercise = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;

export type Routine = typeof routines.$inferSelect;
export type NewRoutine = typeof routines.$inferInsert;

export type TrainingPlan = typeof trainingPlans.$inferSelect;
export type NewTrainingPlan = typeof trainingPlans.$inferInsert;

export type ScheduledRoutine = typeof scheduledRoutines.$inferSelect;
export type NewScheduledRoutine = typeof scheduledRoutines.$inferInsert;

export type RoutineExercise = typeof routineExercises.$inferSelect;
export type NewRoutineExercise = typeof routineExercises.$inferInsert;

export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;

export type PostWorkoutFeedback = typeof postWorkoutFeedback.$inferSelect;
export type NewPostWorkoutFeedback = typeof postWorkoutFeedback.$inferInsert;

export type CoachRecommendation = typeof coachRecommendations.$inferSelect;
export type NewCoachRecommendation = typeof coachRecommendations.$inferInsert;

export type WorkoutSet = typeof workoutSets.$inferSelect;
export type NewWorkoutSet = typeof workoutSets.$inferInsert;

export type WorkoutExerciseNoteRow = typeof workoutExerciseNotes.$inferSelect;
export type NewWorkoutExerciseNoteRow = typeof workoutExerciseNotes.$inferInsert;

export type WorkoutQueueMutation = typeof workoutQueueMutations.$inferSelect;
export type NewWorkoutQueueMutation = typeof workoutQueueMutations.$inferInsert;

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

export type HabitLog = typeof habitLogs.$inferSelect;
export type NewHabitLog = typeof habitLogs.$inferInsert;

export type HabitTargetScheduleRow = typeof habitTargetSchedules.$inferSelect;
export type NewHabitTargetScheduleRow = typeof habitTargetSchedules.$inferInsert;
export type HabitTargetDayRow = typeof habitTargetDays.$inferSelect;
export type NewHabitTargetDayRow = typeof habitTargetDays.$inferInsert;
