import { createHash } from "node:crypto";
import { storagePut } from "../storage";
import type { DocumentFamily, ParsedSifDocument, SifDocumentCandidate, SourceAttestation } from "./contracts";
import { parseSifPdf, sectionHash } from "./parser";
import { discoverSbiCandidates } from "./providers/sbi";
import { discoverHtmlFactsheetCandidates } from "./providers/genericHtml";
import { discoverQsifCandidates } from "./providers/qsif";
import {
  createDocumentVersion,
  createFactWithEvidence,
  createProvenanceEvent,
  createStrategySection,
  getDocumentByProviderHash,
  getOrCreateStrategy,
  getSourceWithContext,
  markSourceChecked,
  updateSourceFreshness,
} from "./repository";

type SourceContext = NonNullable<Awaited<ReturnType<typeof getSourceWithContext>>>;

type IngestRequest = {
  sourceId: number;
  url: string;
  title?: string;
  sourcePageUrl?: string;
  sourceAttestation: SourceAttestation;
  uploaderId?: number;
  fileBytes?: Buffer;
  originalFileName?: string;
};

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const OFFICIAL_DOCUMENT_TIMEOUT_MS = 180_000;

function allowedDomains(context: SourceContext) {
  try {
    const parsed = JSON.parse(context.source.allowedDomainsJson);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function isAllowedHost(rawUrl: string, domains: string[]) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return domains.some((domain) => {
      const normalized = domain.toLowerCase();
      if (normalized.startsWith("*.")) {
        const suffix = normalized.slice(2);
        return host === suffix || host.endsWith(`.${suffix}`);
      }
      return host === normalized;
    });
  } catch {
    return false;
  }
}

function friendlyFileName(url: string) {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").at(-1) || "official-sif-document.pdf");
  } catch {
    return "official-sif-document.pdf";
  }
}

function parseStatusForSource(documentFamily: DocumentFamily, parsed?: ParsedSifDocument) {
  if (!parsed) return "failed" as const;
  if (documentFamily === "factsheet" && parsed.sections.length === 0) return "failed" as const;
  return "parsed" as const;
}

function freshnessFor(context: SourceContext, parsed?: ParsedSifDocument) {
  if (!parsed?.documentDate) return { status: "unverified" as const, reason: "The document has no confidently detected printed reporting date." };
  const expectedCadence = context.source.expectedCadenceDays;
  if (!expectedCadence) return { status: "current" as const, reason: "Official document retrieved and verified; no fixed refresh cadence is configured for this source." };
  const ageDays = Math.floor((Date.now() - parsed.documentDate.getTime()) / 86_400_000);
  const permittedAge = expectedCadence + context.source.staleGraceDays;
  if (ageDays > permittedAge) {
    return { status: "stale" as const, reason: `Printed reporting date is ${ageDays} days old; this source expects an update within approximately ${permittedAge} days.` };
  }
  return { status: "current" as const, reason: "Printed reporting date is within the configured source freshness window." };
}

async function downloadApprovedPdf(startUrl: string, domains: string[]) {
  let currentUrl = startUrl;
  for (let hop = 0; hop < 5; hop += 1) {
    if (!isAllowedHost(currentUrl, domains)) throw new Error("Document URL is not on an approved provider or delivery domain");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OFFICIAL_DOCUMENT_TIMEOUT_MS);
    try {
      const response = await fetch(currentUrl, {
        headers: { "User-Agent": "1FinanceSIFReader/1.0 (+official document retrieval)", Accept: "application/pdf,*/*;q=0.8" },
        redirect: "manual",
        signal: controller.signal,
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error("Official document redirect did not include a destination");
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      if (!response.ok) throw new Error(`Official document request returned ${response.status}`);
      const reportedSize = Number(response.headers.get("content-length") || 0);
      if (reportedSize > MAX_PDF_BYTES) throw new Error("Official document exceeds the 25 MB ingestion limit");
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.byteLength > MAX_PDF_BYTES) throw new Error("Official document exceeds the 25 MB ingestion limit");
      if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("The official source did not return a valid PDF file");
      return { bytes, finalUrl: currentUrl, mimeType: response.headers.get("content-type")?.split(";")[0] || "application/pdf" };
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("Official document exceeded the approved redirect limit");
}

async function persistParsedDocument(context: SourceContext, input: IngestRequest, bytes: Buffer, finalUrl: string, mimeType: string) {
  const contentSha256 = createHash("sha256").update(bytes).digest("hex");
  const existing = await getDocumentByProviderHash(context.provider.id, contentSha256);
  const originalFileName = input.originalFileName || friendlyFileName(finalUrl);

  if (existing) {
    await createProvenanceEvent({
      documentId: existing.id,
      sourceId: context.source.id,
      uploaderId: input.uploaderId ?? null,
      ingestMethod: input.fileBytes ? "user_upload" : input.sourceAttestation === "official" ? "registry_download" : "direct_url",
      originalUrl: input.url,
      finalUrl,
      originalFileName,
      sourceAttestation: input.sourceAttestation,
      validationStatus: input.sourceAttestation === "user_supplied" ? "unverified" : "verified",
      validationNote: "Content hash matched an immutable cached document; the cached version was reused.",
    });
    return { documentId: existing.id, reusedCache: true, parsed: existing.parseStatus === "parsed", message: "Reused an immutable cached document with the same content hash." };
  }

  let parsed: ParsedSifDocument | undefined;
  let parseError: string | undefined;
  try {
    parsed = await parseSifPdf(bytes);
  } catch (error) {
    parseError = error instanceof Error ? error.message : "Native PDF parsing failed";
  }

  const storage = await storagePut(
    `sif-documents/${context.provider.slug}/${context.source.documentFamily}/${contentSha256}.pdf`,
    bytes,
    "application/pdf",
  );
  const title = input.title?.trim() || parsed?.title?.trim() || originalFileName.replace(/\.pdf$/i, "");
  const documentId = await createDocumentVersion({
    providerId: context.provider.id,
    productId: context.product?.id ?? null,
    sourceId: context.source.id,
    documentFamily: context.source.documentFamily,
    scopeLevel: "provider_level",
    title: title.slice(0, 512),
    versionLabel: parsed?.documentDateLabel ?? null,
    originalUrl: input.url,
    resolvedUrl: finalUrl,
    storageKey: storage.key,
    stableFileUrl: storage.url,
    originalFileName,
    contentSha256,
    byteSize: bytes.byteLength,
    mimeType,
    documentDate: parsed?.documentDate ?? null,
    retrievedAt: new Date(),
    lastVerifiedAt: input.sourceAttestation === "user_supplied" ? null : new Date(),
    parseStatus: parseStatusForSource(context.source.documentFamily, parsed),
    parseError: parseError ?? (context.source.documentFamily === "factsheet" && parsed?.sections.length === 0 ? "No deterministic strategy heading was found in this factsheet." : null),
    extractedText: parsed?.extractedText ?? null,
  });

  await createProvenanceEvent({
    documentId,
    sourceId: context.source.id,
    uploaderId: input.uploaderId ?? null,
    ingestMethod: input.fileBytes ? "user_upload" : input.sourceAttestation === "official" ? "registry_download" : "direct_url",
    originalUrl: input.url,
    finalUrl,
    originalFileName,
    sourceAttestation: input.sourceAttestation,
    validationStatus: input.sourceAttestation === "user_supplied" ? "unverified" : "verified",
    validationNote: parsed ? "PDF signature, approved source domain (where applicable), immutable content hash, and native page-aware parsing completed." : `PDF signature and immutable cache completed; deterministic parse failed: ${parseError ?? "unknown error"}`,
  });

  if (!parsed || !context.product) {
    return {
      documentId,
      reusedCache: false,
      parsed: false,
      message: parsed ? "Document was cached, but its product context is not configured for strategy extraction." : "Document was cached, but deterministic parsing did not complete. No facts were published.",
    };
  }

  const freshness = freshnessFor(context, parsed);
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
      extractionMethod: "native_pdf_text.strategy_heading_v2",
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
        extractionMethod: "native_pdf_text.deterministic_v2",
        status: "verified",
      }, {
        documentId,
        sectionId,
        pageNumber: fact.pageNumber,
        quote: fact.quote,
        tableContext: fact.evidenceType === "table" ? fact.key : null,
        boundingBoxJson: null,
        evidenceType: fact.evidenceType,
        extractionMethod: "native_pdf_text.deterministic_v2",
        confidence: String(fact.confidence),
        reviewStatus: "verified",
      });
      factCount += 1;
    }

    await updateSourceFreshness({
      strategyId: strategy.id,
      sourceId: context.source.id,
      documentId,
      documentDate: parsed.documentDate,
      status: freshness.status,
      reason: freshness.reason,
    });
  }

  return {
    documentId,
    reusedCache: false,
    parsed: true,
    factCount,
    strategyCount: parsed.sections.length,
    message: parsed.sections.length
      ? `Cached the document and published ${factCount} evidence-backed facts across ${parsed.sections.length} detected strategy sections.`
      : "Cached the document, but no strategy section was published because no clear deterministic strategy heading was found.",
  };
}

export async function discoverOfficialDocuments(sourceId: number, requestedPeriod?: string) {
  const context = await getSourceWithContext(sourceId);
  if (!context) throw new Error("Official source was not found");
  try {
    let candidates: SifDocumentCandidate[];
    if (context.provider.slug === "sbi-magnum-sif") {
      candidates = await discoverSbiCandidates({
        listingUrl: context.source.listingUrl,
        documentFamily: context.source.documentFamily,
        sourceKind: context.source.sourceKind,
      }, requestedPeriod);
    } else if (context.provider.slug === "quant-qsif") {
      candidates = await discoverQsifCandidates({
        listingUrl: context.source.listingUrl,
        documentFamily: context.source.documentFamily,
        providerName: context.provider.name,
        productName: context.product?.name ?? context.provider.name,
        allowedDomains: allowedDomains(context),
      }, requestedPeriod);
    } else if (context.source.sourceKind === "direct_pdf") {
      candidates = [{
        title: friendlyFileName(context.source.listingUrl).replace(/\.pdf$/i, ""),
        url: context.source.listingUrl,
        sourcePageUrl: context.source.listingUrl,
        documentFamily: context.source.documentFamily,
      }];
    } else if (context.source.sourceKind === "listing_page") {
      candidates = await discoverHtmlFactsheetCandidates({
        listingUrl: context.source.listingUrl,
        documentFamily: context.source.documentFamily,
        providerName: context.provider.name,
        productName: context.product?.name ?? context.provider.name,
        allowedDomains: allowedDomains(context),
      }, requestedPeriod);
    } else {
      candidates = [];
    }
    await markSourceChecked(sourceId);
    return candidates;
  } catch (error) {
    await markSourceChecked(sourceId);
    throw error;
  }
}

export async function ingestOfficialCandidate(sourceId: number, candidateUrl: string) {
  const context = await getSourceWithContext(sourceId);
  if (!context) throw new Error("Official source was not found");
  const candidates = await discoverOfficialDocuments(sourceId);
  const candidate = candidates.find((item) => item.url === candidateUrl);
  if (!candidate) throw new Error("This PDF was not discovered from the selected official source. Use controlled direct-PDF import only for a separately verified provider URL.");
  const downloaded = await downloadApprovedPdf(candidate.url, allowedDomains(context));
  return persistParsedDocument(context, {
    sourceId,
    url: candidate.url,
    title: candidate.title,
    sourcePageUrl: candidate.sourcePageUrl,
    sourceAttestation: "official",
  }, downloaded.bytes, downloaded.finalUrl, downloaded.mimeType);
}

export async function ingestOfficialDirectUrl(sourceId: number, rawUrl: string) {
  const context = await getSourceWithContext(sourceId);
  if (!context) throw new Error("Official source was not found");
  if (!isAllowedHost(rawUrl, allowedDomains(context))) throw new Error("Direct PDF URL is not on a provider-approved delivery domain for the selected source");
  const downloaded = await downloadApprovedPdf(rawUrl, allowedDomains(context));
  return persistParsedDocument(context, {
    sourceId,
    url: rawUrl,
    sourceAttestation: "direct_source",
  }, downloaded.bytes, downloaded.finalUrl, downloaded.mimeType);
}

export async function ingestUserSuppliedPdf(input: { sourceId: number; bytes: Buffer; originalFileName: string; uploaderId: number }) {
  if (input.bytes.byteLength > MAX_PDF_BYTES) throw new Error("Uploaded PDF exceeds the 25 MB ingestion limit");
  if (input.bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("Uploaded file is not a valid PDF");
  const context = await getSourceWithContext(input.sourceId);
  if (!context) throw new Error("Official source was not found");
  return persistParsedDocument(context, {
    sourceId: input.sourceId,
    url: `user-upload://${input.originalFileName}`,
    sourceAttestation: "user_supplied",
    uploaderId: input.uploaderId,
    fileBytes: input.bytes,
    originalFileName: input.originalFileName,
  }, input.bytes, `user-upload://${input.originalFileName}`, "application/pdf");
}
