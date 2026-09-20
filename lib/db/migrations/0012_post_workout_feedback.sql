CREATE TABLE `post_workout_feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`workout_id` integer NOT NULL,
	`local_date` text NOT NULL,
	`effort` integer NOT NULL,
	`sensation` text NOT NULL,
	`discomfort_json` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT `post_workout_feedback_effort_check` CHECK(`effort` BETWEEN 1 AND 10),
	CONSTRAINT `post_workout_feedback_sensation_check` CHECK(`sensation` IN ('great', 'good', 'neutral', 'hard', 'bad'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `post_workout_feedback_workout_id_unique` ON `post_workout_feedback` (`workout_id`);
--> statement-breakpoint
CREATE INDEX `post_workout_feedback_user_local_date_idx` ON `post_workout_feedback` (`user_id`,`local_date`);
