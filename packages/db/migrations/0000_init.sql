CREATE TABLE `audit_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`audit_id` text NOT NULL,
	`at` text NOT NULL,
	`level` text NOT NULL,
	`phase` text,
	`message` text NOT NULL,
	`data` text,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `events_audit_idx` ON `audit_events` (`audit_id`,`id`);--> statement-breakpoint
CREATE TABLE `audits` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`host` text NOT NULL,
	`mode` text NOT NULL,
	`status` text NOT NULL,
	`config` text NOT NULL,
	`created_at` text NOT NULL,
	`started_at` text,
	`finished_at` text,
	`phase` text,
	`schema_version` integer NOT NULL,
	`engine_versions` text,
	`coverage` text,
	`sampling_policy` text,
	`error` text,
	`cancel_requested` integer DEFAULT false NOT NULL,
	`label` text
);
--> statement-breakpoint
CREATE INDEX `audits_host_idx` ON `audits` (`host`,`created_at`);--> statement-breakpoint
CREATE TABLE `discovered_urls` (
	`audit_id` text NOT NULL,
	`url` text NOT NULL,
	`original_url` text NOT NULL,
	`source` text NOT NULL,
	`source_url` text,
	`depth` integer NOT NULL,
	`state` text NOT NULL,
	`reason` text,
	`http_status` integer,
	`content_type` text,
	`final_url` text,
	`redirect_chain` text,
	`in_sitemap` integer DEFAULT false NOT NULL,
	`sampled` integer DEFAULT false NOT NULL,
	`sample_reason` text,
	`template_cluster` text,
	`discovered_at` text NOT NULL,
	`attempted_at` text,
	`checked_at` text,
	PRIMARY KEY(`audit_id`, `url`),
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `urls_state_idx` ON `discovered_urls` (`audit_id`,`state`);--> statement-breakpoint
CREATE TABLE `evidence_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`audit_id` text NOT NULL,
	`url` text,
	`kind` text NOT NULL,
	`path` text NOT NULL,
	`content_type` text NOT NULL,
	`bytes` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `artifacts_audit_idx` ON `evidence_artifacts` (`audit_id`);--> statement-breakpoint
CREATE TABLE `exports` (
	`id` text PRIMARY KEY NOT NULL,
	`audit_id` text NOT NULL,
	`format` text NOT NULL,
	`artifact_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `finding_groups` (
	`audit_id` text NOT NULL,
	`signature` text NOT NULL,
	`rule_id` text NOT NULL,
	`module` text NOT NULL,
	`title` text NOT NULL,
	`severity` text NOT NULL,
	`confidence` text NOT NULL,
	`affected_pages` integer NOT NULL,
	`tested_pages` integer NOT NULL,
	`template_hint` text,
	`priority` real NOT NULL,
	`priority_components` text NOT NULL,
	`enough_evidence` integer NOT NULL,
	`sample_urls` text NOT NULL,
	`recommended_action` text NOT NULL,
	PRIMARY KEY(`audit_id`, `signature`),
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `findings` (
	`finding_id` text PRIMARY KEY NOT NULL,
	`audit_id` text NOT NULL,
	`rule_id` text NOT NULL,
	`url` text NOT NULL,
	`module` text NOT NULL,
	`status` text NOT NULL,
	`severity` text NOT NULL,
	`confidence` text NOT NULL,
	`observed_at` text NOT NULL,
	`engine_version` text NOT NULL,
	`evidence` text NOT NULL,
	`recommended_action` text NOT NULL,
	`applicability` text NOT NULL,
	`reason` text,
	`group_signature` text,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `findings_audit_status_idx` ON `findings` (`audit_id`,`status`);--> statement-breakpoint
CREATE INDEX `findings_audit_rule_idx` ON `findings` (`audit_id`,`rule_id`);--> statement-breakpoint
CREATE INDEX `findings_audit_url_idx` ON `findings` (`audit_id`,`url`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`status` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 2 NOT NULL,
	`run_after` text NOT NULL,
	`lease_until` text,
	`worker_id` text,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `jobs_ready_idx` ON `jobs` (`status`,`run_after`);--> statement-breakpoint
CREATE TABLE `llm_analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`audit_id` text NOT NULL,
	`task` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`question` text,
	`payload` text NOT NULL,
	`output` text,
	`cited_finding_ids` text,
	`invalid_citations` text,
	`status` text NOT NULL,
	`error` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `llm_audit_idx` ON `llm_analyses` (`audit_id`);--> statement-breakpoint
CREATE TABLE `page_snapshots` (
	`audit_id` text NOT NULL,
	`url` text NOT NULL,
	`status` integer NOT NULL,
	`final_url` text NOT NULL,
	`content_type` text NOT NULL,
	`bytes` integer NOT NULL,
	`elapsed_ms` integer NOT NULL,
	`fetched_at` text NOT NULL,
	`features` text,
	`browser` text,
	PRIMARY KEY(`audit_id`, `url`),
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade
);
