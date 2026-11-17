CREATE TABLE `invitation_mail` (
	`email` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`updated` text NOT NULL,
	`sent_at` text,
	`error` text
);
