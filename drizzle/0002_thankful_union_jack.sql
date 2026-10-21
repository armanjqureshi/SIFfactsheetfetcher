ALTER TABLE `sif_products` ADD `sif_landing_url` varchar(1024);--> statement-breakpoint
ALTER TABLE `sif_products` ADD `factsheet_listing_url` varchar(1024);--> statement-breakpoint
ALTER TABLE `sif_products` ADD `factsheet_availability` enum('verified_available','not_verified') DEFAULT 'not_verified' NOT NULL;--> statement-breakpoint
ALTER TABLE `sif_products` ADD `factsheet_notes` text;--> statement-breakpoint
ALTER TABLE `sif_products` ADD `registry_evidence_urls_json` mediumtext;--> statement-breakpoint
ALTER TABLE `sif_products` ADD `registry_verified_at` timestamp;