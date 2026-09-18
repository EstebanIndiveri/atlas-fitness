CREATE TABLE `routines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`kind` text DEFAULT 'gym' NOT NULL,
	`rest_seconds` integer DEFAULT 90 NOT NULL,
	`is_system` integer DEFAULT true NOT NULL,
	`user_id` integer,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `routines_slug_unique` ON `routines` (`slug`);
--> statement-breakpoint
CREATE TABLE `routine_exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`routine_id` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	`sort_order` integer NOT NULL,
	`target_sets` integer NOT NULL,
	`target_reps` integer NOT NULL,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `routine_exercises_routine_id_sort_order_unique` ON `routine_exercises` (`routine_id`,`sort_order`);
--> statement-breakpoint
ALTER TABLE `workouts` ADD `routine_id` integer;
