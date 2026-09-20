-- Close extra active workouts (keep latest id per user) so the unique index can apply.
-- Nested subquery is required by SQLite when updating the same table.
UPDATE `workouts`
SET `ended_at` = unixepoch()
WHERE `id` IN (
  SELECT `id` FROM (
    SELECT `id` FROM `workouts`
    WHERE `deleted_at` IS NULL
      AND `ended_at` IS NULL
      AND `id` NOT IN (
        SELECT MAX(`id`) FROM `workouts`
        WHERE `deleted_at` IS NULL AND `ended_at` IS NULL
        GROUP BY `user_id`
      )
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workouts_user_id_active_unique` ON `workouts` (`user_id`) WHERE `ended_at` IS NULL AND `deleted_at` IS NULL;
