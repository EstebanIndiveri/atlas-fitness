ALTER TABLE `routines` ADD COLUMN `training_plan_id` integer REFERENCES `training_plans`(`id`) ON UPDATE no action ON DELETE no action;
--> statement-breakpoint
CREATE INDEX `routines_training_plan_id_idx` ON `routines` (`training_plan_id`);
