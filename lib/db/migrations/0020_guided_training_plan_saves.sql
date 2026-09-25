CREATE TABLE `guided_training_plan_saves` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`client_mutation_id` text NOT NULL,
	`payload_hash` text NOT NULL,
	`training_plan_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`training_plan_id`) REFERENCES `training_plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guided_training_plan_saves_user_mutation_unique` ON `guided_training_plan_saves` (`user_id`,`client_mutation_id`);
