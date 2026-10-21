CREATE TABLE `sif_chat_turns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`question` text NOT NULL,
	`answer` mediumtext NOT NULL,
	`document_ids_json` text NOT NULL,
	`section_ids_json` text NOT NULL,
	`evidence_ids_json` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sif_chat_turns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sif_document_provenance_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`document_id` int NOT NULL,
	`source_id` int,
	`uploader_id` int,
	`ingest_method` enum('registry_download','direct_url','user_upload','manual_import') NOT NULL,
	`original_url` varchar(2048),
	`final_url` varchar(2048),
	`original_file_name` varchar(512),
	`source_attestation` enum('official','direct_source','user_supplied','legacy_import') NOT NULL,
	`validation_status` enum('verified','partially_verified','unverified','rejected') NOT NULL,
	`validation_note` text,
	`observed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sif_document_provenance_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sif_document_strategy_sections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`document_id` int NOT NULL,
	`strategy_id` int,
	`variant_id` int,
	`scope_level` enum('provider_level','product_level','strategy_level','document_section_level','regulatory_context_level') NOT NULL DEFAULT 'document_section_level',
	`raw_heading` varchar(512) NOT NULL,
	`normalized_heading` varchar(512) NOT NULL,
	`page_start` int NOT NULL,
	`page_end` int NOT NULL,
	`extracted_text` mediumtext NOT NULL,
	`section_hash` varchar(64) NOT NULL,
	`extraction_method` varchar(128) NOT NULL,
	`confidence` decimal(5,2) NOT NULL,
	`status` enum('verified','candidate','withheld') NOT NULL DEFAULT 'candidate',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sif_document_strategy_sections_id` PRIMARY KEY(`id`),
	CONSTRAINT `sif_sections_document_heading_uq` UNIQUE(`document_id`,`normalized_heading`)
);
--> statement-breakpoint
CREATE TABLE `sif_document_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider_id` int NOT NULL,
	`product_id` int,
	`source_id` int,
	`document_family` enum('factsheet','portfolio','isid_kim','sai','ter','notice','regulatory') NOT NULL,
	`scope_level` enum('provider_level','product_level','strategy_level','document_section_level','regulatory_context_level') NOT NULL DEFAULT 'provider_level',
	`title` varchar(512) NOT NULL,
	`version_label` varchar(256),
	`original_url` varchar(2048) NOT NULL,
	`resolved_url` varchar(2048),
	`storage_key` varchar(512),
	`stable_file_url` varchar(1024),
	`original_file_name` varchar(512),
	`content_sha256` varchar(64) NOT NULL,
	`byte_size` int NOT NULL,
	`mime_type` varchar(128) NOT NULL,
	`document_date` timestamp,
	`published_at` timestamp,
	`retrieved_at` timestamp NOT NULL DEFAULT (now()),
	`last_verified_at` timestamp,
	`parse_status` enum('discovered','downloading','parsed','failed','rejected') NOT NULL DEFAULT 'discovered',
	`parse_error` text,
	`extracted_text` mediumtext,
	`supersedes_document_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sif_document_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sif_documents_provider_hash_uq` UNIQUE(`provider_id`,`content_sha256`)
);
--> statement-breakpoint
CREATE TABLE `sif_fact_evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fact_id` int NOT NULL,
	`document_id` int NOT NULL,
	`section_id` int,
	`page_number` int NOT NULL,
	`quote` mediumtext NOT NULL,
	`table_context` text,
	`bounding_box_json` text,
	`evidence_type` enum('text','table','visual','calculated','external_reference') NOT NULL DEFAULT 'text',
	`extraction_method` varchar(128) NOT NULL,
	`confidence` decimal(5,2) NOT NULL,
	`review_status` enum('verified','unreviewed','rejected') NOT NULL DEFAULT 'verified',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sif_fact_evidence_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sif_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider_id` int NOT NULL,
	`name` varchar(256) NOT NULL,
	`normalized_name` varchar(256) NOT NULL,
	`external_code` varchar(128),
	`status` enum('active','inactive','unknown') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sif_products_id` PRIMARY KEY(`id`),
	CONSTRAINT `sif_products_provider_name_uq` UNIQUE(`provider_id`,`normalized_name`)
);
--> statement-breakpoint
CREATE TABLE `sif_provider_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider_id` int NOT NULL,
	`product_id` int,
	`document_family` enum('factsheet','portfolio','isid_kim','sai','ter','notice','regulatory') NOT NULL,
	`label` varchar(256) NOT NULL,
	`listing_url` varchar(1024) NOT NULL,
	`source_kind` enum('listing_page','direct_pdf','public_feed','manual') NOT NULL DEFAULT 'listing_page',
	`discovery_mode` enum('html_links','dynamic','direct','manual') NOT NULL DEFAULT 'html_links',
	`allowed_domains_json` mediumtext NOT NULL,
	`expected_cadence_days` int,
	`stale_grace_days` int NOT NULL DEFAULT 10,
	`priority` int NOT NULL DEFAULT 1,
	`is_active` int NOT NULL DEFAULT 1,
	`last_checked_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sif_provider_sources_id` PRIMARY KEY(`id`),
	CONSTRAINT `sif_sources_url_uq` UNIQUE(`listing_url`)
);
--> statement-breakpoint
CREATE TABLE `sif_providers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`website_url` varchar(1024),
	`is_active` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sif_providers_id` PRIMARY KEY(`id`),
	CONSTRAINT `sif_providers_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `sif_regulatory_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rule_key` varchar(128) NOT NULL,
	`title` varchar(512) NOT NULL,
	`value_text` mediumtext NOT NULL,
	`scope_level` enum('provider_level','product_level','strategy_level','document_section_level','regulatory_context_level') NOT NULL DEFAULT 'regulatory_context_level',
	`provider_id` int,
	`product_id` int,
	`strategy_id` int,
	`effective_from` timestamp NOT NULL,
	`effective_to` timestamp,
	`source_url` varchar(2048) NOT NULL,
	`source_document_id` int,
	`citation_page` int,
	`last_verified_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sif_regulatory_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sif_strategies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`name` varchar(320) NOT NULL,
	`normalized_name` varchar(320) NOT NULL,
	`strategy_code` varchar(128),
	`status` enum('active','inactive','unknown') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sif_strategies_id` PRIMARY KEY(`id`),
	CONSTRAINT `sif_strategies_product_name_uq` UNIQUE(`product_id`,`normalized_name`)
);
--> statement-breakpoint
CREATE TABLE `sif_strategy_facts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`document_id` int NOT NULL,
	`section_id` int,
	`strategy_id` int,
	`scope_level` enum('provider_level','product_level','strategy_level','document_section_level','regulatory_context_level') NOT NULL,
	`fact_key` varchar(128) NOT NULL,
	`qualifier` varchar(256),
	`value_text` mediumtext,
	`value_number` decimal(20,6),
	`value_unit` varchar(64),
	`as_of_date` timestamp,
	`display_order` int NOT NULL DEFAULT 0,
	`extraction_method` varchar(128) NOT NULL,
	`status` enum('verified','candidate','withheld','calculated') NOT NULL DEFAULT 'candidate',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sif_strategy_facts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sif_strategy_freshness` (
	`id` int AUTO_INCREMENT NOT NULL,
	`strategy_id` int,
	`source_id` int NOT NULL,
	`document_id` int,
	`status` enum('current','stale','unavailable','unverified','unchanged','candidate_rejected') NOT NULL,
	`document_date` timestamp,
	`last_verified_at` timestamp,
	`evaluated_at` timestamp NOT NULL DEFAULT (now()),
	`reason` text,
	CONSTRAINT `sif_strategy_freshness_id` PRIMARY KEY(`id`),
	CONSTRAINT `sif_freshness_strategy_source_uq` UNIQUE(`strategy_id`,`source_id`)
);
--> statement-breakpoint
CREATE TABLE `sif_strategy_variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`strategy_id` int NOT NULL,
	`name` varchar(256) NOT NULL,
	`normalized_name` varchar(256) NOT NULL,
	`variant_type` enum('approach','option','share_class','plan','other') NOT NULL DEFAULT 'other',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sif_strategy_variants_id` PRIMARY KEY(`id`),
	CONSTRAINT `sif_strategy_variants_strategy_name_uq` UNIQUE(`strategy_id`,`normalized_name`)
);
--> statement-breakpoint
ALTER TABLE `sif_chat_turns` ADD CONSTRAINT `sif_chat_turns_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sif_document_provenance_events` ADD CONSTRAINT `fk_prov_doc` FOREIGN KEY (`document_id`) REFERENCES `sif_document_versions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sif_document_provenance_events` ADD CONSTRAINT `fk_prov_source` FOREIGN KEY (`source_id`) REFERENCES `sif_provider_sources`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sif_document_provenance_events` ADD CONSTRAINT `fk_prov_uploader` FOREIGN KEY (`uploader_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sif_document_strategy_sections` ADD CONSTRAINT `fk_section_doc` FOREIGN KEY (`document_id`) REFERENCES `sif_document_versions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sif_document_strategy_sections` ADD CONSTRAINT `fk_section_strategy` FOREIGN KEY (`strategy_id`) REFERENCES `sif_strategies`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sif_document_strategy_sections` ADD CONSTRAINT `fk_section_variant` FOREIGN KEY (`variant_id`) REFERENCES `sif_strategy_variants`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sif_document_versions` ADD CONSTRAINT `fk_doc_provider` FOREIGN KEY (`provider_id`) REFERENCES `sif_providers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sif_document_versions` ADD CONSTRAINT `fk_doc_product` FOREIGN KEY (`product_id`) REFERENCES `sif_products`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sif_document_versions` ADD CONSTRAINT `fk_doc_source` FOREIGN KEY (`source_id`) REFERENCES `sif_provider_sources`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sif_fact_evidence` ADD CONSTRAINT `fk_evidence_fact` FOREIGN KEY (`fact_id`) REFERENCES `sif_strategy_facts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sif_fact_evidence` ADD CONSTRAINT `fk_evidence_doc` FOREIGN KEY (`document_id`) REFERENCES `sif_document_versions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sif_fact_evidence` ADD CONSTRAINT `fk_evidence_section` FOREIGN KEY (`section_id`) REFERENCES `sif_document_strategy_sections`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sif_products` ADD CONSTRAINT `fk_product_provider` FOREIGN KEY (`provider_id`) REFERENCES `sif_providers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sif_provider_sources` ADD CONSTRAINT `fk_source_provider` FOREIGN KEY (`provider_id`) REFERENCES `sif_providers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sif_provider_sources` ADD CONSTRAINT `fk_source_product` FOREIGN KEY (`product_id`) REFERENCES `sif_products`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sif_regulatory_rules` ADD CONSTRAINT `fk_rule_provider` FOREIGN KEY (`provider_id`) REFERENCES `sif_providers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sif_regulatory_rules` ADD CONSTRAINT `fk_rule_product` FOREIGN KEY (`product_id`) REFERENCES `sif_products`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sif_regulatory_rules` ADD CONSTRAINT `fk_rule_strategy` FOREIGN KEY (`strategy_id`) REFERENCES `sif_strategies`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sif_regulatory_rules` ADD CONSTRAINT `fk_rule_document` FOREIGN KEY (`source_document_id`) REFERENCES `sif_document_versions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sif_strategies` ADD CONSTRAINT `fk_strategy_product` FOREIGN KEY (`product_id`) REFERENCES `sif_products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sif_strategy_facts` ADD CONSTRAINT `fk_fact_doc` FOREIGN KEY (`document_id`) REFERENCES `sif_document_versions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sif_strategy_facts` ADD CONSTRAINT `fk_fact_section` FOREIGN KEY (`section_id`) REFERENCES `sif_document_strategy_sections`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sif_strategy_facts` ADD CONSTRAINT `fk_fact_strategy` FOREIGN KEY (`strategy_id`) REFERENCES `sif_strategies`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sif_strategy_freshness` ADD CONSTRAINT `fk_fresh_strategy` FOREIGN KEY (`strategy_id`) REFERENCES `sif_strategies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sif_strategy_freshness` ADD CONSTRAINT `fk_fresh_source` FOREIGN KEY (`source_id`) REFERENCES `sif_provider_sources`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sif_strategy_freshness` ADD CONSTRAINT `fk_fresh_doc` FOREIGN KEY (`document_id`) REFERENCES `sif_document_versions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sif_strategy_variants` ADD CONSTRAINT `fk_variant_strategy` FOREIGN KEY (`strategy_id`) REFERENCES `sif_strategies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `sif_chat_turns_user_idx` ON `sif_chat_turns` (`user_id`);--> statement-breakpoint
CREATE INDEX `sif_provenance_document_idx` ON `sif_document_provenance_events` (`document_id`);--> statement-breakpoint
CREATE INDEX `sif_sections_strategy_document_idx` ON `sif_document_strategy_sections` (`strategy_id`,`document_id`);--> statement-breakpoint
CREATE INDEX `sif_documents_source_family_date_idx` ON `sif_document_versions` (`source_id`,`document_family`,`document_date`);--> statement-breakpoint
CREATE INDEX `sif_documents_provider_family_idx` ON `sif_document_versions` (`provider_id`,`document_family`);--> statement-breakpoint
CREATE INDEX `sif_evidence_fact_idx` ON `sif_fact_evidence` (`fact_id`);--> statement-breakpoint
CREATE INDEX `sif_evidence_document_page_idx` ON `sif_fact_evidence` (`document_id`,`page_number`);--> statement-breakpoint
CREATE INDEX `sif_products_provider_idx` ON `sif_products` (`provider_id`);--> statement-breakpoint
CREATE INDEX `sif_sources_provider_family_idx` ON `sif_provider_sources` (`provider_id`,`document_family`);--> statement-breakpoint
CREATE INDEX `sif_rules_key_effective_idx` ON `sif_regulatory_rules` (`rule_key`,`effective_from`);--> statement-breakpoint
CREATE INDEX `sif_strategies_product_idx` ON `sif_strategies` (`product_id`);--> statement-breakpoint
CREATE INDEX `sif_facts_strategy_key_idx` ON `sif_strategy_facts` (`strategy_id`,`fact_key`);--> statement-breakpoint
CREATE INDEX `sif_facts_document_section_idx` ON `sif_strategy_facts` (`document_id`,`section_id`);--> statement-breakpoint
CREATE INDEX `sif_freshness_source_status_idx` ON `sif_strategy_freshness` (`source_id`,`status`);--> statement-breakpoint
CREATE INDEX `sif_strategy_variants_strategy_idx` ON `sif_strategy_variants` (`strategy_id`);
