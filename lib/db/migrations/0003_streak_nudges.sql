CREATE TABLE `streak_nudges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`local_date` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `streak_nudges_user_id_local_date_kind_unique` ON `streak_nudges` (`user_id`,`local_date`,`kind`);
