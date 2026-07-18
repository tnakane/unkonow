CREATE TABLE `poop_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`country_code` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`source` text DEFAULT 'live' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `poop_events_expires_at_idx` ON `poop_events` (`expires_at`);--> statement-breakpoint
CREATE INDEX `poop_events_country_created_idx` ON `poop_events` (`country_code`,`created_at`);--> statement-breakpoint
CREATE INDEX `poop_events_room_created_idx` ON `poop_events` (`room_id`,`created_at`);