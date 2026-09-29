CREATE TABLE `habit_target_schedules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`habit_key` text NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT `habit_target_schedules_habit_key_check` CHECK(`habit_key` IN ('hydration', 'walk', 'mobility', 'sleep')),
	CONSTRAINT `habit_target_schedules_version_check` CHECK(`version` >= 1),
	CONSTRAINT `habit_target_schedules_effective_range_check` CHECK(`effective_to` IS NULL OR `effective_to` >= `effective_from`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `habit_target_schedules_active_unique` ON `habit_target_schedules` (`user_id`,`habit_key`) WHERE `effective_to` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `habit_target_schedules_user_habit_effective_from_unique` ON `habit_target_schedules` (`user_id`,`habit_key`,`effective_from`);
--> statement-breakpoint
CREATE INDEX `habit_target_schedules_user_effective_range_idx` ON `habit_target_schedules` (`user_id`,`effective_from`,`effective_to`);
--> statement-breakpoint
CREATE TABLE `habit_target_days` (
	`schedule_id` integer NOT NULL,
	`day_of_week` integer NOT NULL,
	PRIMARY KEY(`schedule_id`, `day_of_week`),
	FOREIGN KEY (`schedule_id`) REFERENCES `habit_target_schedules`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `habit_target_days_day_of_week_check` CHECK(`day_of_week` BETWEEN 0 AND 6)
);
