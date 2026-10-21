import {
  decimal,
  index,
  int,
  mediumtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const scopeLevels = [
  "provider_level",
  "product_level",
  "strategy_level",
  "document_section_level",
  "regulatory_context_level",
] as const;

/** Core user table backing the Manus OAuth flow. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** SIF issuer / AMC. Kept separate from the mutual-fund application's provider model. */
export const sifProviders = mysqlTable(
  "sif_providers",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    websiteUrl: varchar("website_url", { length: 1024 }),
    isActive: int("is_active").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("sif_providers_slug_uq").on(table.slug)],
);

/** A provider's SIF product grouping, where the provider exposes one. */
export const sifProducts = mysqlTable(
  "sif_products",
  {
    id: int("id").autoincrement().primaryKey(),
    providerId: int("provider_id").notNull().references(() => sifProviders.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 256 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 256 }).notNull(),
    externalCode: varchar("external_code", { length: 128 }),
    sifLandingUrl: varchar("sif_landing_url", { length: 1024 }),
    factsheetListingUrl: varchar("factsheet_listing_url", { length: 1024 }),
    factsheetAvailability: mysqlEnum("factsheet_availability", ["verified_available", "not_verified"]).default("not_verified").notNull(),
    factsheetNotes: text("factsheet_notes"),
    registryEvidenceUrlsJson: mediumtext("registry_evidence_urls_json"),
    registryVerifiedAt: timestamp("registry_verified_at"),
    status: mysqlEnum("status", ["active", "inactive", "unknown"]).default("active").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("sif_products_provider_name_uq").on(table.providerId, table.normalizedName),
    index("sif_products_provider_idx").on(table.providerId),
  ],
);

/** The primary reader and comparison unit. */
export const sifStrategies = mysqlTable(
  "sif_strategies",
  {
    id: int("id").autoincrement().primaryKey(),
    productId: int("product_id").notNull().references(() => sifProducts.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 320 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 320 }).notNull(),
    strategyCode: varchar("strategy_code", { length: 128 }),
    status: mysqlEnum("status", ["active", "inactive", "unknown"]).default("active").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("sif_strategies_product_name_uq").on(table.productId, table.normalizedName),
    index("sif_strategies_product_idx").on(table.productId),
  ],
);

/** Optional provider-defined approach, option, plan, or share-class layer. */
export const sifStrategyVariants = mysqlTable(
  "sif_strategy_variants",
  {
    id: int("id").autoincrement().primaryKey(),
    strategyId: int("strategy_id").notNull().references(() => sifStrategies.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 256 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 256 }).notNull(),
    variantType: mysqlEnum("variant_type", ["approach", "option", "share_class", "plan", "other"]).default("other").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("sif_strategy_variants_strategy_name_uq").on(table.strategyId, table.normalizedName),
    index("sif_strategy_variants_strategy_idx").on(table.strategyId),
  ],
);

/** Approved official source configuration, including provider-associated CDNs. */
export const sifProviderSources = mysqlTable(
  "sif_provider_sources",
  {
    id: int("id").autoincrement().primaryKey(),
    providerId: int("provider_id").notNull().references(() => sifProviders.id, { onDelete: "cascade" }),
    productId: int("product_id").references(() => sifProducts.id, { onDelete: "set null" }),
    documentFamily: mysqlEnum("document_family", ["factsheet", "portfolio", "isid_kim", "sai", "ter", "notice", "regulatory"]).notNull(),
    label: varchar("label", { length: 256 }).notNull(),
    listingUrl: varchar("listing_url", { length: 1024 }).notNull(),
    sourceKind: mysqlEnum("source_kind", ["listing_page", "direct_pdf", "public_feed", "manual"]).default("listing_page").notNull(),
    discoveryMode: mysqlEnum("discovery_mode", ["html_links", "dynamic", "direct", "manual"]).default("html_links").notNull(),
    allowedDomainsJson: mediumtext("allowed_domains_json").notNull(),
    expectedCadenceDays: int("expected_cadence_days"),
    staleGraceDays: int("stale_grace_days").default(10).notNull(),
    priority: int("priority").default(1).notNull(),
    isActive: int("is_active").default(1).notNull(),
    lastCheckedAt: timestamp("last_checked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    // The SQL migration indexes only the first 768 characters: MySQL 8 caps keys at 3,072 bytes.
    uniqueIndex("sif_sources_url_uq").on(table.listingUrl),
    index("sif_sources_provider_family_idx").on(table.providerId, table.documentFamily),
  ],
);

/** Immutable cached document. A later correction is a new row linked through supersedesDocumentId. */
export const sifDocumentVersions = mysqlTable(
  "sif_document_versions",
  {
    id: int("id").autoincrement().primaryKey(),
    providerId: int("provider_id").notNull().references(() => sifProviders.id, { onDelete: "cascade" }),
    productId: int("product_id").references(() => sifProducts.id, { onDelete: "set null" }),
    sourceId: int("source_id").references(() => sifProviderSources.id, { onDelete: "set null" }),
    documentFamily: mysqlEnum("document_family", ["factsheet", "portfolio", "isid_kim", "sai", "ter", "notice", "regulatory"]).notNull(),
    scopeLevel: mysqlEnum("scope_level", scopeLevels).default("provider_level").notNull(),
    title: varchar("title", { length: 512 }).notNull(),
    versionLabel: varchar("version_label", { length: 256 }),
    originalUrl: varchar("original_url", { length: 2048 }).notNull(),
    resolvedUrl: varchar("resolved_url", { length: 2048 }),
    storageKey: varchar("storage_key", { length: 512 }),
    stableFileUrl: varchar("stable_file_url", { length: 1024 }),
    originalFileName: varchar("original_file_name", { length: 512 }),
    contentSha256: varchar("content_sha256", { length: 64 }).notNull(),
    byteSize: int("byte_size").notNull(),
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    documentDate: timestamp("document_date"),
    publishedAt: timestamp("published_at"),
    retrievedAt: timestamp("retrieved_at").defaultNow().notNull(),
    lastVerifiedAt: timestamp("last_verified_at"),
    parseStatus: mysqlEnum("parse_status", ["discovered", "downloading", "parsed", "failed", "rejected"]).default("discovered").notNull(),
    parseError: text("parse_error"),
    extractedText: mediumtext("extracted_text"),
    supersedesDocumentId: int("supersedes_document_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("sif_documents_provider_hash_uq").on(table.providerId, table.contentSha256),
    index("sif_documents_source_family_date_idx").on(table.sourceId, table.documentFamily, table.documentDate),
    index("sif_documents_provider_family_idx").on(table.providerId, table.documentFamily),
  ],
);

/** Append-only acquisition record for document provenance. */
export const sifDocumentProvenanceEvents = mysqlTable(
  "sif_document_provenance_events",
  {
    id: int("id").autoincrement().primaryKey(),
    documentId: int("document_id").notNull().references(() => sifDocumentVersions.id, { onDelete: "cascade" }),
    sourceId: int("source_id").references(() => sifProviderSources.id, { onDelete: "set null" }),
    uploaderId: int("uploader_id").references(() => users.id, { onDelete: "set null" }),
    ingestMethod: mysqlEnum("ingest_method", ["registry_download", "direct_url", "user_upload", "manual_import"]).notNull(),
    originalUrl: varchar("original_url", { length: 2048 }),
    finalUrl: varchar("final_url", { length: 2048 }),
    originalFileName: varchar("original_file_name", { length: 512 }),
    sourceAttestation: mysqlEnum("source_attestation", ["official", "direct_source", "user_supplied", "legacy_import"]).notNull(),
    validationStatus: mysqlEnum("validation_status", ["verified", "partially_verified", "unverified", "rejected"]).notNull(),
    validationNote: text("validation_note"),
    observedAt: timestamp("observed_at").defaultNow().notNull(),
  },
  (table) => [index("sif_provenance_document_idx").on(table.documentId)],
);

/** A strategy-scoped section detected in one immutable document. */
export const sifDocumentStrategySections = mysqlTable(
  "sif_document_strategy_sections",
  {
    id: int("id").autoincrement().primaryKey(),
    documentId: int("document_id").notNull().references(() => sifDocumentVersions.id, { onDelete: "cascade" }),
    strategyId: int("strategy_id").references(() => sifStrategies.id, { onDelete: "set null" }),
    variantId: int("variant_id").references(() => sifStrategyVariants.id, { onDelete: "set null" }),
    scopeLevel: mysqlEnum("scope_level", scopeLevels).default("document_section_level").notNull(),
    rawHeading: varchar("raw_heading", { length: 512 }).notNull(),
    normalizedHeading: varchar("normalized_heading", { length: 512 }).notNull(),
    pageStart: int("page_start").notNull(),
    pageEnd: int("page_end").notNull(),
    extractedText: mediumtext("extracted_text").notNull(),
    sectionHash: varchar("section_hash", { length: 64 }).notNull(),
    extractionMethod: varchar("extraction_method", { length: 128 }).notNull(),
    confidence: decimal("confidence", { precision: 5, scale: 2 }).notNull(),
    status: mysqlEnum("status", ["verified", "candidate", "withheld"]).default("candidate").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("sif_sections_document_heading_uq").on(table.documentId, table.normalizedHeading),
    index("sif_sections_strategy_document_idx").on(table.strategyId, table.documentId),
  ],
);

/** Typed observation from an explicit document scope. */
export const sifStrategyFacts = mysqlTable(
  "sif_strategy_facts",
  {
    id: int("id").autoincrement().primaryKey(),
    documentId: int("document_id").notNull().references(() => sifDocumentVersions.id, { onDelete: "cascade" }),
    sectionId: int("section_id").references(() => sifDocumentStrategySections.id, { onDelete: "set null" }),
    strategyId: int("strategy_id").references(() => sifStrategies.id, { onDelete: "set null" }),
    scopeLevel: mysqlEnum("scope_level", scopeLevels).notNull(),
    factKey: varchar("fact_key", { length: 128 }).notNull(),
    qualifier: varchar("qualifier", { length: 256 }),
    valueText: mediumtext("value_text"),
    valueNumber: decimal("value_number", { precision: 20, scale: 6 }),
    valueUnit: varchar("value_unit", { length: 64 }),
    asOfDate: timestamp("as_of_date"),
    displayOrder: int("display_order").default(0).notNull(),
    extractionMethod: varchar("extraction_method", { length: 128 }).notNull(),
    status: mysqlEnum("status", ["verified", "candidate", "withheld", "calculated"]).default("candidate").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("sif_facts_strategy_key_idx").on(table.strategyId, table.factKey),
    index("sif_facts_document_section_idx").on(table.documentId, table.sectionId),
  ],
);

/** Page-level receipt for an individual fact. */
export const sifFactEvidence = mysqlTable(
  "sif_fact_evidence",
  {
    id: int("id").autoincrement().primaryKey(),
    factId: int("fact_id").notNull().references(() => sifStrategyFacts.id, { onDelete: "cascade" }),
    documentId: int("document_id").notNull().references(() => sifDocumentVersions.id, { onDelete: "cascade" }),
    sectionId: int("section_id").references(() => sifDocumentStrategySections.id, { onDelete: "set null" }),
    pageNumber: int("page_number").notNull(),
    quote: mediumtext("quote").notNull(),
    tableContext: text("table_context"),
    boundingBoxJson: text("bounding_box_json"),
    evidenceType: mysqlEnum("evidence_type", ["text", "table", "visual", "calculated", "external_reference"]).default("text").notNull(),
    extractionMethod: varchar("extraction_method", { length: 128 }).notNull(),
    confidence: decimal("confidence", { precision: 5, scale: 2 }).notNull(),
    reviewStatus: mysqlEnum("review_status", ["verified", "unreviewed", "rejected"]).default("verified").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("sif_evidence_fact_idx").on(table.factId),
    index("sif_evidence_document_page_idx").on(table.documentId, table.pageNumber),
  ],
);

/** Materialised source-aware freshness state for a strategy/source family. */
export const sifStrategyFreshness = mysqlTable(
  "sif_strategy_freshness",
  {
    id: int("id").autoincrement().primaryKey(),
    strategyId: int("strategy_id").references(() => sifStrategies.id, { onDelete: "cascade" }),
    sourceId: int("source_id").notNull().references(() => sifProviderSources.id, { onDelete: "cascade" }),
    documentId: int("document_id").references(() => sifDocumentVersions.id, { onDelete: "set null" }),
    status: mysqlEnum("status", ["current", "stale", "unavailable", "unverified", "unchanged", "candidate_rejected"]).notNull(),
    documentDate: timestamp("document_date"),
    lastVerifiedAt: timestamp("last_verified_at"),
    evaluatedAt: timestamp("evaluated_at").defaultNow().notNull(),
    reason: text("reason"),
  },
  (table) => [
    uniqueIndex("sif_freshness_strategy_source_uq").on(table.strategyId, table.sourceId),
    index("sif_freshness_source_status_idx").on(table.sourceId, table.status),
  ],
);

/** Versioned regulatory context, distinct from provider/strategy disclosures. */
export const sifRegulatoryRules = mysqlTable(
  "sif_regulatory_rules",
  {
    id: int("id").autoincrement().primaryKey(),
    ruleKey: varchar("rule_key", { length: 128 }).notNull(),
    title: varchar("title", { length: 512 }).notNull(),
    valueText: mediumtext("value_text").notNull(),
    scopeLevel: mysqlEnum("scope_level", scopeLevels).default("regulatory_context_level").notNull(),
    providerId: int("provider_id").references(() => sifProviders.id, { onDelete: "set null" }),
    productId: int("product_id").references(() => sifProducts.id, { onDelete: "set null" }),
    strategyId: int("strategy_id").references(() => sifStrategies.id, { onDelete: "set null" }),
    effectiveFrom: timestamp("effective_from").notNull(),
    effectiveTo: timestamp("effective_to"),
    sourceUrl: varchar("source_url", { length: 2048 }).notNull(),
    sourceDocumentId: int("source_document_id").references(() => sifDocumentVersions.id, { onDelete: "set null" }),
    citationPage: int("citation_page"),
    lastVerifiedAt: timestamp("last_verified_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("sif_rules_key_effective_idx").on(table.ruleKey, table.effectiveFrom),
  ],
);

/** A persisted answer audit record; citations are retained as immutable ID snapshots. */
export const sifChatTurns = mysqlTable(
  "sif_chat_turns",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    answer: mediumtext("answer").notNull(),
    documentIdsJson: text("document_ids_json").notNull(),
    sectionIdsJson: text("section_ids_json").notNull(),
    evidenceIdsJson: text("evidence_ids_json").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("sif_chat_turns_user_idx").on(table.userId)],
);

export type SifProvider = typeof sifProviders.$inferSelect;
export type SifProduct = typeof sifProducts.$inferSelect;
export type SifStrategy = typeof sifStrategies.$inferSelect;
export type SifProviderSource = typeof sifProviderSources.$inferSelect;
export type SifDocumentVersion = typeof sifDocumentVersions.$inferSelect;
export type SifDocumentSection = typeof sifDocumentStrategySections.$inferSelect;
export type SifStrategyFact = typeof sifStrategyFacts.$inferSelect;
export type SifFactEvidenceRecord = typeof sifFactEvidence.$inferSelect;
