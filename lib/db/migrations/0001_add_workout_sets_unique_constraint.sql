-- Add unique constraint on workout_sets (workout_id, set_index) for non-deleted rows
-- This prevents duplicate set_index values within the same workout
CREATE UNIQUE INDEX `workout_sets_workout_id_set_index_unique` ON `workout_sets` (`workout_id`, `set_index`) WHERE `deleted_at` IS NULL;
