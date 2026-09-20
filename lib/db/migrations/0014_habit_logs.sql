CREATE TABLE `habit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`local_date` text NOT NULL,
	`habit_key` text NOT NULL,
	`done` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT `habit_logs_habit_key_check` CHECK(`habit_key` IN ('hydration', 'walk', 'mobility', 'sleep'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `habit_logs_user_id_local_date_habit_key_unique` ON `habit_logs` (`user_id`,`local_date`,`habit_key`);
--> statement-breakpoint
CREATE INDEX `habit_logs_user_id_local_date_idx` ON `habit_logs` (`user_id`,`local_date`);
