import { and, desc, eq, inArray } from "drizzle-orm";
import {
  sifDocumentProvenanceEvents,
  sifDocumentStrategySections,
  sifDocumentVersions,
  sifFactEvidence,
  sifProducts,
  sifProviderSources,
  sifProviders,
  sifStrategies,
  sifChatTurns,
  sifStrategyFacts,
  sifStrategyFreshness,
  type SifDocumentVersion,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { SBI_MAGNUM_SIF_PROVIDER } from "./providers/sbi";
import { OFFICIAL_SIF_PROVIDER_REGISTRY, OFFICIAL_SIF_REGISTRY_OBSERVED_AT, type OfficialSifProviderDefinition } from "./providers/officialRegistry";
import { normalizeSifName } from "./parser";

function sbiRegistryDefinition(): OfficialSifProviderDefinition {
  return {
    name: SBI_MAGNUM_SIF_PROVIDER.name,
    slug: SBI_MAGNUM_SIF_PROVIDER.slug,
    websiteUrl: SBI_MAGNUM_SIF_PROVIDER.websiteUrl,
    productName: SBI_MAGNUM_SIF_PROVIDER.productName,
    productNormalizedName: SBI_MAGNUM_SIF_PROVIDER.productNormalizedName,
    sifLandingUrl: "https://www.sbimf.com/magnumsif",
    factsheetListingUrl: "https://www.sbimf.com/magnumsif-factsheets",
    factsheetAvailability: "verified_available",
    factsheetNotes: "Official Magnum SIF page publishes dated all-schemes factsheets and retains historical monthly files.",
    evidenceUrls: ["https://www.sbimf.com/magnumsif", "https://www.sbimf.com/magnumsif-factsheets", "https://portal.amfiindia.com/spages/S-33.pdf"],
    allowedDomains: SBI_MAGNUM_SIF_PROVIDER.allowedDomains,
    sources: SBI_MAGNUM_SIF_PROVIDER.sources,
  };
}

export async function ensureOfficialSifRegistrySeeded() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  for (const definition of [sbiRegistryDefinition(), ...OFFICIAL_SIF_PROVIDER_REGISTRY]) {
    await db.insert(sifProviders).values({
      name: definition.name,
      slug: definition.slug,
      websiteUrl: definition.websiteUrl,
      isActive: 1,
    }).onDuplicateKeyUpdate({
      set: { name: definition.name, websiteUrl: definition.websiteUrl, isActive: 1 },
    });

    const provider = (await db.select().from(sifProviders).where(eq(sifProviders.slug, definition.slug)).limit(1))[0];
    if (!provider) throw new Error(`${definition.name} could not be initialized`);

    await db.insert(sifProducts).values({
      providerId: provider.id,
      name: definition.productName,
      normalizedName: definition.productNormalizedName,
      sifLandingUrl: definition.sifLandingUrl,
      factsheetListingUrl: definition.factsheetListingUrl ?? null,
      factsheetAvailability: definition.factsheetAvailability,
      factsheetNotes: definition.factsheetNotes,
      registryEvidenceUrlsJson: JSON.stringify(definition.evidenceUrls),
      registryVerifiedAt: OFFICIAL_SIF_REGISTRY_OBSERVED_AT,
      status: "active",
    }).onDuplicateKeyUpdate({ set: {
      name: definition.productName,
      sifLandingUrl: definition.sifLandingUrl,
      factsheetListingUrl: definition.factsheetListingUrl ?? null,
      factsheetAvailability: definition.factsheetAvailability,
      factsheetNotes: definition.factsheetNotes,
      registryEvidenceUrlsJson: JSON.stringify(definition.evidenceUrls),
      registryVerifiedAt: OFFICIAL_SIF_REGISTRY_OBSERVED_AT,
      status: "active",
    } });

    const product = (await db.select().from(sifProducts).where(and(
      eq(sifProducts.providerId, provider.id),
      eq(sifProducts.normalizedName, definition.productNormalizedName),
    )).limit(1))[0];
    if (!product) throw new Error(`${definition.productName} could not be initialized`);

    const sources = definition.sources ?? [{
      documentFamily: "factsheet" as const,
      label: `${definition.productName} factsheet direct-PDF / upload fallback`,
      listingUrl: definition.factsheetListingUrl ?? definition.sifLandingUrl,
      sourceKind: "manual" as const,
      discoveryMode: "manual" as const,
      expectedCadenceDays: 31,
      staleGraceDays: 10,
    }];
    for (const source of sources) {
      await db.insert(sifProviderSources).values({
        providerId: provider.id,
        productId: product.id,
        documentFamily: source.documentFamily,
        label: source.label,
        listingUrl: source.listingUrl,
        sourceKind: source.sourceKind,
        discoveryMode: source.discoveryMode,
        allowedDomainsJson: JSON.stringify(definition.allowedDomains),
        expectedCadenceDays: source.expectedCadenceDays,
        staleGraceDays: source.staleGraceDays,
        priority: definition.factsheetAvailability === "verified_available" ? 1 : 99,
        isActive: 1,
      }).onDuplicateKeyUpdate({
        set: {
          label: source.label,
          sourceKind: source.sourceKind,
          discoveryMode: source.discoveryMode,
          allowedDomainsJson: JSON.stringify(definition.allowedDomains),
          expectedCadenceDays: source.expectedCadenceDays,
          staleGraceDays: source.staleGraceDays,
          isActive: 1,
        },
      });
    }
  }
}

/** Backwards-compatible entry point retained for the initial SBI vertical slice. */
export async function ensureSbiSeeded() {
  await ensureOfficialSifRegistrySeeded();
}

export async function listSifWorkspace() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await ensureOfficialSifRegistrySeeded();

  const [providers, products, sources, documents, freshnessRows] = await Promise.all([
    db.select().from(sifProviders).where(eq(sifProviders.isActive, 1)).orderBy(sifProviders.name),
    db.select({
      id: sifProducts.id,
      providerId: sifProducts.providerId,
      providerName: sifProviders.name,
      providerSlug: sifProviders.slug,
      name: sifProducts.name,
      sifLandingUrl: sifProducts.sifLandingUrl,
      factsheetListingUrl: sifProducts.factsheetListingUrl,
      factsheetAvailability: sifProducts.factsheetAvailability,
      factsheetNotes: sifProducts.factsheetNotes,
      registryEvidenceUrlsJson: sifProducts.registryEvidenceUrlsJson,
      registryVerifiedAt: sifProducts.registryVerifiedAt,
    }).from(sifProducts)
      .innerJoin(sifProviders, eq(sifProducts.providerId, sifProviders.id))
      .where(eq(sifProducts.status, "active"))
      .orderBy(sifProviders.name),
    db.select({
      id: sifProviderSources.id,
      providerId: sifProviderSources.providerId,
      productId: sifProviderSources.productId,
      providerName: sifProviders.name,
      productName: sifProducts.name,
      documentFamily: sifProviderSources.documentFamily,
      label: sifProviderSources.label,
      listingUrl: sifProviderSources.listingUrl,
      expectedCadenceDays: sifProviderSources.expectedCadenceDays,
      staleGraceDays: sifProviderSources.staleGraceDays,
      lastCheckedAt: sifProviderSources.lastCheckedAt,
      sourceKind: sifProviderSources.sourceKind,
      discoveryMode: sifProviderSources.discoveryMode,
      isActive: sifProviderSources.isActive,
    }).from(sifProviderSources)
      .innerJoin(sifProviders, eq(sifProviderSources.providerId, sifProviders.id))
      .leftJoin(sifProducts, eq(sifProviderSources.productId, sifProducts.id))
      .where(eq(sifProviderSources.isActive, 1))
      .orderBy(sifProviderSources.priority),
    db.select({
      id: sifDocumentVersions.id,
      providerId: sifDocumentVersions.providerId,
      sourceId: sifDocumentVersions.sourceId,
      providerName: sifProviders.name,
      documentFamily: sifDocumentVersions.documentFamily,
      title: sifDocumentVersions.title,
      documentDate: sifDocumentVersions.documentDate,
      retrievedAt: sifDocumentVersions.retrievedAt,
      lastVerifiedAt: sifDocumentVersions.lastVerifiedAt,
      stableFileUrl: sifDocumentVersions.stableFileUrl,
      parseStatus: sifDocumentVersions.parseStatus,
      scopeLevel: sifDocumentVersions.scopeLevel,
    }).from(sifDocumentVersions)
      .innerJoin(sifProviders, eq(sifDocumentVersions.providerId, sifProviders.id))
      .orderBy(desc(sifDocumentVersions.documentDate), desc(sifDocumentVersions.retrievedAt)),
    db.select({
      documentId: sifStrategyFreshness.documentId,
      status: sifStrategyFreshness.status,
      reason: sifStrategyFreshness.reason,
      evaluatedAt: sifStrategyFreshness.evaluatedAt,
    }).from(sifStrategyFreshness).orderBy(desc(sifStrategyFreshness.evaluatedAt)),
  ]);

  const freshnessByDocument = new Map<number, { status: typeof freshnessRows[number]["status"]; reason: string | null; evaluatedAt: Date }>();
  for (const row of freshnessRows) {
    if (row.documentId && !freshnessByDocument.has(row.documentId)) {
      freshnessByDocument.set(row.documentId, { status: row.status, reason: row.reason, evaluatedAt: row.evaluatedAt });
    }
  }

  return {
    providers,
    products: products.map((product) => {
      let registryEvidenceUrls: string[] = [];
      try {
        const parsed = JSON.parse(product.registryEvidenceUrlsJson ?? "[]");
        registryEvidenceUrls = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
      } catch {
        registryEvidenceUrls = [];
      }
      return { ...product, registryEvidenceUrls };
    }),
    sources,
    documents: documents.map((document) => {
      const freshness = freshnessByDocument.get(document.id);
      return {
        ...document,
        freshnessStatus: freshness?.status ?? "unverified",
        freshnessReason: freshness?.reason ?? "No source-aware freshness evaluation is available for this cached document.",
        freshnessEvaluatedAt: freshness?.evaluatedAt ?? null,
      };
    }),
  };
}

export async function getSourceWithContext(sourceId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return (await db.select({
    source: sifProviderSources,
    provider: sifProviders,
    product: sifProducts,
  }).from(sifProviderSources)
    .innerJoin(sifProviders, eq(sifProviderSources.providerId, sifProviders.id))
    .leftJoin(sifProducts, eq(sifProviderSources.productId, sifProducts.id))
    .where(eq(sifProviderSources.id, sourceId))
    .limit(1))[0];
}

export async function markSourceChecked(sourceId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(sifProviderSources).set({ lastCheckedAt: new Date() }).where(eq(sifProviderSources.id, sourceId));
}

export async function getDocumentByProviderHash(providerId: number, contentSha256: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return (await db.select().from(sifDocumentVersions).where(and(
    eq(sifDocumentVersions.providerId, providerId),
    eq(sifDocumentVersions.contentSha256, contentSha256),
  )).limit(1))[0];
}

export async function createDocumentVersion(document: typeof sifDocumentVersions.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return Number((await db.insert(sifDocumentVersions).values(document))[0].insertId);
}

export async function createProvenanceEvent(event: typeof sifDocumentProvenanceEvents.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return Number((await db.insert(sifDocumentProvenanceEvents).values(event))[0].insertId);
}

export async function getOrCreateStrategy(productId: number, name: string, normalizedName = normalizeSifName(name)) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(sifStrategies).values({ productId, name, normalizedName, status: "active" })
    .onDuplicateKeyUpdate({ set: { name, status: "active" } });
  const strategy = (await db.select().from(sifStrategies).where(and(
    eq(sifStrategies.productId, productId),
    eq(sifStrategies.normalizedName, normalizedName),
  )).limit(1))[0];
  if (!strategy) throw new Error(`Strategy could not be saved: ${name}`);
  return strategy;
}

export async function createStrategySection(section: typeof sifDocumentStrategySections.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return Number((await db.insert(sifDocumentStrategySections).values(section))[0].insertId);
}

/** Retain the source PDF and prior extraction rows for audit, but exclude superseded parser output from reader queries. */
export async function retireDocumentExtraction(documentId: number, parserVersion: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async (tx) => {
    const previousSections = await tx.select({ id: sifDocumentStrategySections.id })
      .from(sifDocumentStrategySections)
      .where(eq(sifDocumentStrategySections.documentId, documentId));

    await tx.update(sifStrategyFacts).set({ status: "withheld" }).where(eq(sifStrategyFacts.documentId, documentId));
    for (const section of previousSections) {
      await tx.update(sifDocumentStrategySections).set({
        status: "withheld",
        normalizedHeading: `superseded-${parserVersion}-${section.id}`.slice(0, 512),
      }).where(eq(sifDocumentStrategySections.id, section.id));
    }
    return previousSections.length;
  });
}

export async function createFactWithEvidence(
  fact: typeof sifStrategyFacts.$inferInsert,
  evidence: Omit<typeof sifFactEvidence.$inferInsert, "factId">,
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const factId = Number((await db.insert(sifStrategyFacts).values(fact))[0].insertId);
  const evidenceId = Number((await db.insert(sifFactEvidence).values({ ...evidence, factId }))[0].insertId);
  return { factId, evidenceId };
}

export async function updateSourceFreshness(input: {
  strategyId: number;
  sourceId: number;
  documentId: number;
  documentDate?: Date;
  status: "current" | "stale" | "unavailable" | "unverified" | "unchanged" | "candidate_rejected";
  reason?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(sifStrategyFreshness).values({
    strategyId: input.strategyId,
    sourceId: input.sourceId,
    documentId: input.documentId,
    documentDate: input.documentDate,
    lastVerifiedAt: input.status === "current" ? new Date() : null,
    status: input.status,
    reason: input.reason ?? null,
  }).onDuplicateKeyUpdate({ set: {
    documentId: input.documentId,
    documentDate: input.documentDate,
    lastVerifiedAt: input.status === "current" ? new Date() : null,
    status: input.status,
    reason: input.reason ?? null,
    evaluatedAt: new Date(),
  } });
}

export async function getDocumentReader(documentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const document = (await db.select({
    document: sifDocumentVersions,
    providerName: sifProviders.name,
    providerSlug: sifProviders.slug,
  }).from(sifDocumentVersions)
    .innerJoin(sifProviders, eq(sifDocumentVersions.providerId, sifProviders.id))
    .where(eq(sifDocumentVersions.id, documentId))
    .limit(1))[0];
  if (!document) return undefined;

  const sections = await db.select({
    section: sifDocumentStrategySections,
    strategyName: sifStrategies.name,
  }).from(sifDocumentStrategySections)
    .leftJoin(sifStrategies, eq(sifDocumentStrategySections.strategyId, sifStrategies.id))
    .where(and(
      eq(sifDocumentStrategySections.documentId, documentId),
      eq(sifDocumentStrategySections.status, "verified"),
    ))
    .orderBy(sifDocumentStrategySections.pageStart);

  const sectionIds = sections.map((row) => row.section.id);
  const facts = sectionIds.length
    ? await db.select({ fact: sifStrategyFacts, strategyName: sifStrategies.name })
      .from(sifStrategyFacts)
      .leftJoin(sifStrategies, eq(sifStrategyFacts.strategyId, sifStrategies.id))
      .where(and(
        inArray(sifStrategyFacts.sectionId, sectionIds),
        eq(sifStrategyFacts.status, "verified"),
      ))
      .orderBy(sifStrategyFacts.displayOrder)
    : [];
  const factIds = facts.map((row) => row.fact.id);
  const rawEvidence = factIds.length
    ? await db.select().from(sifFactEvidence).where(inArray(sifFactEvidence.factId, factIds))
    : [];
  const evidence = rawEvidence.filter((item) => item.reviewStatus === "verified"
    && item.pageNumber > 0
    && item.documentId === documentId
    && item.sectionId !== null
    && sectionIds.includes(item.sectionId));
  const evidenceByFact = new Map<number, typeof evidence>();
  for (const item of evidence) {
    const current = evidenceByFact.get(item.factId) ?? [];
    current.push(item);
    evidenceByFact.set(item.factId, current);
  }
  const publishedFacts = facts.filter((row) => {
    const receipts = evidenceByFact.get(row.fact.id) ?? [];
    return receipts.some((receipt) => receipt.documentId === row.fact.documentId && receipt.sectionId === row.fact.sectionId);
  });

  return {
    document,
    sections: sections.map((row) => ({
      ...row.section,
      strategyName: row.strategyName,
      facts: publishedFacts.filter((fact) => fact.fact.sectionId === row.section.id).map((fact) => ({
        ...fact.fact,
        strategyName: fact.strategyName,
        evidence: evidenceByFact.get(fact.fact.id) ?? [],
      })),
    })),
  };
}

export async function getDocumentFactsForChat(documentId: number, sectionId?: number) {
  const reader = await getDocumentReader(documentId);
  if (!reader) return undefined;
  const selectedSections = sectionId ? reader.sections.filter((section) => section.id === sectionId) : reader.sections;
  return { document: reader.document, sections: selectedSections };
}

export async function recordSifChatTurn(input: {
  userId: number;
  question: string;
  answer: string;
  documentIds: number[];
  sectionIds: number[];
  evidenceIds: number[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(sifChatTurns).values({
    userId: input.userId,
    question: input.question,
    answer: input.answer,
    documentIdsJson: JSON.stringify(input.documentIds),
    sectionIdsJson: JSON.stringify(input.sectionIds),
    evidenceIdsJson: JSON.stringify(input.evidenceIds),
  });
}

export async function listDocumentsForComparison(documentIds: number[]) {
  const db = await getDb();
  if (!db || documentIds.length === 0) return [] as SifDocumentVersion[];
  return db.select().from(sifDocumentVersions).where(inArray(sifDocumentVersions.id, documentIds));
}
