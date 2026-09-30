ALTER TABLE `workout_sets` ADD COLUMN `semantic_capture_version` integer CHECK (`semantic_capture_version` IS NULL OR `semantic_capture_version` > 0);
--> statement-breakpoint
ALTER TABLE `workout_sets` ADD COLUMN `load_mode` text CHECK (`load_mode` IS NULL OR `load_mode` IN ('external', 'bodyweight', 'bodyweight_added', 'assisted'));
--> statement-breakpoint
ALTER TABLE `workout_sets` ADD COLUMN `amount_basis` text CHECK (`amount_basis` IS NULL OR `amount_basis` IN ('total', 'per_side')) CHECK (`load_mode` IS NULL OR (`load_mode` = 'bodyweight' AND `amount_basis` IS NULL AND `weight_kg` = '0') OR (`load_mode` <> 'bodyweight' AND `amount_basis` IS NOT NULL));
--> statement-breakpoint
ALTER TABLE `workout_sets` ADD COLUMN `side` text CHECK (`side` IS NULL OR `side` IN ('bilateral', 'left', 'right', 'alternating'));
--> statement-breakpoint
ALTER TABLE `workout_sets` ADD COLUMN `set_purpose` text CHECK (`set_purpose` IS NULL OR `set_purpose` IN ('working', 'warmup'));
--> statement-breakpoint
ALTER TABLE `workout_sets` ADD COLUMN `rep_count_basis` text CHECK (`rep_count_basis` IS NULL OR `rep_count_basis` IN ('total', 'per_side')) CHECK (`side` IS NULL OR (`side` = 'alternating' AND `rep_count_basis` IS NOT NULL) OR (`side` <> 'alternating' AND `rep_count_basis` IS NULL)) CHECK ((`semantic_capture_version` IS NULL AND `load_mode` IS NULL AND `amount_basis` IS NULL AND `side` IS NULL AND `set_purpose` IS NULL AND `rep_count_basis` IS NULL) OR (`semantic_capture_version` IS NOT NULL AND `load_mode` IS NOT NULL AND `side` IS NOT NULL AND `set_purpose` IS NOT NULL));
--> statement-breakpoint
CREATE INDEX `workout_sets_external_pr_cohort_idx` ON `workout_sets` (`exercise_id`, `load_mode`, `amount_basis`, `side`, `reps`, (length(CASE WHEN instr(`weight_kg`, '.') = 0 THEN `weight_kg` ELSE substr(`weight_kg`, 1, instr(`weight_kg`, '.') - 1) END)) DESC, (CASE WHEN instr(`weight_kg`, '.') = 0 THEN `weight_kg` ELSE substr(`weight_kg`, 1, instr(`weight_kg`, '.') - 1) END) DESC, (CASE WHEN instr(`weight_kg`, '.') = 0 THEN '' ELSE substr(`weight_kg`, instr(`weight_kg`, '.') + 1) END) DESC) WHERE `deleted_at` IS NULL AND `completed` = 1;
