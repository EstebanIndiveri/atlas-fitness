CREATE TABLE `training_plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_plans_user_id_active_unique` ON `training_plans` (`user_id`) WHERE `is_active` = 1 AND `deleted_at` IS NULL;
--> statement-breakpoint
CREATE TABLE `scheduled_routines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`training_plan_id` integer NOT NULL,
	`day_of_week` integer NOT NULL,
	`routine_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`training_plan_id`) REFERENCES `training_plans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT `scheduled_routines_day_of_week_check` CHECK(`day_of_week` BETWEEN 0 AND 6)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scheduled_routines_plan_day_unique` ON `scheduled_routines` (`training_plan_id`,`day_of_week`);
