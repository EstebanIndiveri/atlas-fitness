ALTER TABLE `workouts` ADD `queue_json` text;
--> statement-breakpoint
CREATE TABLE `workout_queue_mutations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workout_id` integer NOT NULL,
	`action` text NOT NULL,
	`client_mutation_id` text NOT NULL,
	`exercise_id` integer NOT NULL,
	`response_json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workout_queue_mutations_workout_action_client_unique` ON `workout_queue_mutations` (`workout_id`,`action`,`client_mutation_id`);
