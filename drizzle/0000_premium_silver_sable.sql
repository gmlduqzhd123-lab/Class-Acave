CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `collections_owner` ON `collections` (`owner`);--> statement-breakpoint
CREATE TABLE `imports` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`source` text NOT NULL,
	`base_run` text,
	`expected` integer NOT NULL,
	`status` text NOT NULL,
	`summary` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `imports_owner` ON `imports` (`owner`);--> statement-breakpoint
CREATE TABLE `items` (
	`collection` text NOT NULL,
	`resource` text NOT NULL,
	`owner` text NOT NULL,
	`snapshot` text NOT NULL,
	`note` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`collection`, `resource`)
);
--> statement-breakpoint
CREATE INDEX `items_owner_collection` ON `items` (`owner`,`collection`);--> statement-breakpoint
CREATE TABLE `resources` (
	`run` text NOT NULL,
	`id` text NOT NULL,
	`owner` text NOT NULL,
	`source` text NOT NULL,
	`subject` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`search` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`run`, `id`)
);
--> statement-breakpoint
CREATE INDEX `resources_owner_source_run` ON `resources` (`owner`,`source`,`run`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`active_run` text,
	`updated` text NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
