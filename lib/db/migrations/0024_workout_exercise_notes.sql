CREATE TABLE `workout_exercise_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`workout_id` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	`note` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT `workout_exercise_notes_version_check` CHECK(`version` >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workout_exercise_notes_workout_exercise_unique` ON `workout_exercise_notes` (`workout_id`,`exercise_id`);
--> statement-breakpoint
CREATE INDEX `workout_exercise_notes_user_exercise_updated_idx` ON `workout_exercise_notes` (`user_id`,`exercise_id`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `workouts_user_id_ended_at_idx` ON `workouts` (`user_id`,`ended_at` DESC,`id` DESC) WHERE `deleted_at` IS NULL AND `ended_at` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `workout_sets_exercise_lookup_idx` ON `workout_sets` (`exercise_id`,`workout_id`,`set_index`,`id`) WHERE `deleted_at` IS NULL AND `completed` = 1;
