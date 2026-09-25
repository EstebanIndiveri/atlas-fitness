CREATE TABLE `user_preferences` (
  `user_id` integer PRIMARY KEY NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `goal` text,
  `pace` text,
  `equipment` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  CONSTRAINT `user_preferences_goal_check`
    CHECK (`goal` IS NULL OR `goal` IN ('muscle', 'strength', 'fitness', 'consistency', 'wellbeing')),
  CONSTRAINT `user_preferences_pace_check`
    CHECK (`pace` IS NULL OR `pace` IN ('days-2', 'days-3', 'days-4', 'days-5')),
  CONSTRAINT `user_preferences_equipment_check`
    CHECK (`equipment` IS NULL OR `equipment` IN ('gym', 'dumbbells', 'bodyweight', 'bands'))
);
