import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { sifDocumentVersions } from "../drizzle/schema";
import { getDb } from "../server/db";
import { storageGetSignedUrl } from "../server/storage";
import { parseSifPdf, sectionHash } from "../server/sif/parser";
import {
  createFactWithEvidence,
  createStrategySection,
  getOrCreateStrategy,
  getSourceWithContext,
  retireDocumentExtraction,
  updateSourceFreshness,
} from "../server/sif/repository";

const documentId = Number(process.argv[2]);
const parserVersion = process.argv[3] ?? "v2";
if (!Number.isInteger(documentId) || documentId <= 0) {
  throw new Error("Usage: pnpm exec tsx scripts/reprocessSifDocument.ts <document-id> [parser-version]");
}

const db = await getDb();
if (!db) throw new Error("Database is not available");
const document = (await db.select().from(sifDocumentVersions).where(eq(sifDocumentVersions.id, documentId)).limit(1))[0];
if (!document?.storageKey || !document.sourceId) throw new Error("Document has no immutable cached file or source context");
const context = await getSourceWithContext(document.sourceId);
if (!context?.product) throw new Error("Document source has no SIF product context");

const signedUrl = await storageGetSignedUrl(document.storageKey);
const response = await fetch(signedUrl);
if (!response.ok) throw new Error(`Cached PDF read failed (${response.status})`);
const bytes = Buffer.from(await response.arrayBuffer());
const hash = createHash("sha256").update(bytes).digest("hex");
if (hash !== document.contentSha256) throw new Error("Cached PDF hash does not match its immutable document record");
const parsed = await parseSifPdf(bytes);

const retiredSections = await retireDocumentExtraction(documentId, parserVersion);
let factCount = 0;
for (const parsedSection of parsed.sections) {
  const strategy = await getOrCreateStrategy(context.product.id, parsedSection.heading, parsedSection.normalizedHeading);
  const sectionId = await createStrategySection({
    documentId,
    strategyId: strategy.id,
    variantId: null,
    scopeLevel: "strategy_level",
    rawHeading: parsedSection.heading,
    normalizedHeading: parsedSection.normalizedHeading,
    pageStart: parsedSection.pageStart,
    pageEnd: parsedSection.pageEnd,
    extractedText: parsedSection.text,
    sectionHash: sectionHash(parsedSection),
    extractionMethod: `native_pdf_text.strategy_heading_${parserVersion}`,
    confidence: String(parsedSection.confidence),
    status: "verified",
  });
  for (const fact of parsedSection.facts) {
    await createFactWithEvidence({
      documentId,
      sectionId,
      strategyId: strategy.id,
      scopeLevel: "strategy_level",
      factKey: fact.key,
      qualifier: fact.qualifier ?? null,
      valueText: fact.valueText,
      valueNumber: null,
      valueUnit: null,
      asOfDate: parsed.documentDate ?? null,
      displayOrder: factCount,
      extractionMethod: `native_pdf_text.deterministic_${parserVersion}`,
      status: "verified",
    }, {
      documentId,
      sectionId,
      pageNumber: fact.pageNumber,
      quote: fact.quote,
      tableContext: fact.evidenceType === "table" ? fact.key : null,
      boundingBoxJson: null,
      evidenceType: fact.evidenceType,
      extractionMethod: `native_pdf_text.deterministic_${parserVersion}`,
      confidence: String(fact.confidence),
      reviewStatus: "verified",
    });
    factCount += 1;
  }
  const ageDays = parsed.documentDate ? Math.floor((Date.now() - parsed.documentDate.getTime()) / 86_400_000) : undefined;
  const freshnessWindow = (context.source.expectedCadenceDays ?? 0) + context.source.staleGraceDays;
  const isCurrent = ageDays !== undefined && ageDays <= freshnessWindow;
  await updateSourceFreshness({
    strategyId: strategy.id,
    sourceId: context.source.id,
    documentId,
    documentDate: parsed.documentDate,
    status: parsed.documentDate ? (isCurrent ? "current" : "stale") : "unverified",
    reason: parsed.documentDate
      ? (isCurrent ? "Printed reporting date is within the configured source freshness window." : `Printed reporting date is ${ageDays} days old; this source expects an update within approximately ${freshnessWindow} days.`)
      : "The document has no confidently detected printed reporting date.",
  });
}
console.log(JSON.stringify({ documentId, parserVersion, retiredSections, publishedSections: parsed.sections.length, factCount }, null, 2));
