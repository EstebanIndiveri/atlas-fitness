CREATE TABLE `coach_recommendations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`workout_id` integer NOT NULL,
	`daily_checkin_id` integer,
	`context_snapshot_json` text,
	`source` text NOT NULL,
	`result_json` text NOT NULL,
	`decision` text DEFAULT 'pending' NOT NULL,
	`decided_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`daily_checkin_id`) REFERENCES `daily_checkins`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT `coach_recommendations_source_check` CHECK(`source` IN ('ai', 'deterministic')),
	CONSTRAINT `coach_recommendations_decision_check` CHECK(`decision` IN ('pending', 'accepted', 'rejected'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coach_recommendations_workout_result_unique` ON `coach_recommendations` (`workout_id`,`result_json`);
--> statement-breakpoint
CREATE INDEX `coach_recommendations_user_workout_idx` ON `coach_recommendations` (`user_id`,`workout_id`);
