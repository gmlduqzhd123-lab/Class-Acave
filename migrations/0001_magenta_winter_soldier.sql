CREATE TABLE `members` (
	`email` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`name` text DEFAULT '' NOT NULL,
	`role` text NOT NULL,
	`status` text NOT NULL,
	`added` text NOT NULL,
	`last_seen` text
);
--> statement-breakpoint
CREATE INDEX `members_user_status` ON `members` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`owner_email` text NOT NULL,
	`title` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `collections` ADD `workspace` text;--> statement-breakpoint
ALTER TABLE `collections` ADD `shared` integer DEFAULT 0 NOT NULL;