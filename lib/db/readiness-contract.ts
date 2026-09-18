interface RequiredIndex {
  name: string;
  columns: readonly string[];
  partial?: boolean;
  predicate?: string;
}

interface RequiredTable {
  name: string;
  columns: readonly string[];
  primaryKey: readonly string[];
  indexes: readonly RequiredIndex[];
}

export const REQUIRED_SCHEMA: readonly RequiredTable[] = [
  {
    name: 'users',
    columns: ['id', 'name', 'email', 'password_hash', 'telegram_user_id', 'created_at'],
    primaryKey: ['id'],
    indexes: [
      { name: 'users_email_unique', columns: ['email'] },
      { name: 'users_telegram_user_id_unique', columns: ['telegram_user_id'] },
    ],
  },
  {
    name: 'exercises',
    columns: [
      'id',
      'slug',
      'name',
      'muscle_group',
      'instructions',
      'image_url',
      'video_url',
      'is_system',
      'user_id',
      'deleted_at',
    ],
    primaryKey: ['id'],
    indexes: [{ name: 'exercises_slug_unique', columns: ['slug'] }],
  },
  {
    name: 'routines',
    columns: [
      'id',
      'slug',
      'name',
      'description',
      'kind',
      'rest_seconds',
      'is_system',
      'user_id',
      'deleted_at',
    ],
    primaryKey: ['id'],
    indexes: [{ name: 'routines_slug_unique', columns: ['slug'] }],
  },
  {
    name: 'routine_exercises',
    columns: ['id', 'routine_id', 'exercise_id', 'sort_order', 'target_sets', 'target_reps'],
    primaryKey: ['id'],
    indexes: [
      {
        name: 'routine_exercises_routine_id_sort_order_unique',
        columns: ['routine_id', 'sort_order'],
      },
    ],
  },
  {
    name: 'workouts',
    columns: [
      'id',
      'user_id',
      'routine_id',
      'started_at',
      'ended_at',
      'note',
      'mood',
      'deleted_at',
    ],
    primaryKey: ['id'],
    indexes: [],
  },
  {
    name: 'workout_sets',
    columns: [
      'id',
      'workout_id',
      'exercise_id',
      'set_index',
      'reps',
      'weight_kg',
      'completed',
      'deleted_at',
    ],
    primaryKey: ['id'],
    indexes: [
      {
        name: 'workout_sets_workout_id_set_index_unique',
        columns: ['workout_id', 'set_index'],
        partial: true,
        predicate: 'deleted_at IS NULL',
      },
    ],
  },
  {
    name: 'daily_tips',
    columns: ['id', 'date', 'body', 'source'],
    primaryKey: ['id'],
    indexes: [{ name: 'daily_tips_date_unique', columns: ['date'] }],
  },
  {
    name: 'telegram_link_codes',
    columns: ['id', 'user_id', 'code', 'expires_at', 'used'],
    primaryKey: ['id'],
    indexes: [{ name: 'telegram_link_codes_code_unique', columns: ['code'] }],
  },
  {
    name: 'bot_messages',
    columns: [
      'id',
      'telegram_update_id',
      'user_id',
      'raw_request',
      'response',
      'created_at',
    ],
    primaryKey: ['id'],
    indexes: [{ name: 'bot_messages_telegram_update_id_unique', columns: ['telegram_update_id'] }],
  },
  {
    name: 'user_streaks',
    columns: ['user_id', 'current_streak', 'longest_streak', 'last_workout_date', 'updated_at'],
    primaryKey: ['user_id'],
    indexes: [],
  },
  {
    name: 'daily_checkins',
    columns: ['id', 'user_id', 'local_date', 'mood', 'created_at', 'updated_at'],
    primaryKey: ['id'],
    indexes: [
      {
        name: 'daily_checkins_user_id_local_date_unique',
        columns: ['user_id', 'local_date'],
      },
    ],
  },
  {
    name: 'streak_nudges',
    columns: ['id', 'user_id', 'local_date', 'kind', 'created_at'],
    primaryKey: ['id'],
    indexes: [
      {
        name: 'streak_nudges_user_id_local_date_kind_unique',
        columns: ['user_id', 'local_date', 'kind'],
      },
    ],
  },
];

export const REQUIRED_TABLES = REQUIRED_SCHEMA.map(({ name }) => name);
