ALTER TABLE `daily_checkins` ADD `energy` text CHECK (`energy` IS NULL OR `energy` IN ('low', 'medium', 'high'));
--> statement-breakpoint
ALTER TABLE `daily_checkins` ADD `note` text;
