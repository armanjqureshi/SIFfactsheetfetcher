import type { DocumentFamily, SifDocumentCandidate } from "../contracts";

export const SBI_MAGNUM_SIF_PROVIDER = {
  name: "SBI Funds Management — Magnum SIF",
  slug: "sbi-magnum-sif",
  websiteUrl: "https://www.sbimf.com/magnumsif",
  productName: "Magnum SIF",
  productNormalizedName: "magnum sif",
  allowedDomains: ["sbimf.com", "*.sbimf.com"],
  sources: [
    {
      documentFamily: "factsheet" as const,
      label: "Magnum SIF factsheets",
      listingUrl: "https://www.sbimf.com/magnumsif-factsheets",
      sourceKind: "listing_page" as const,
      discoveryMode: "html_links" as const,
      expectedCadenceDays: 31,
      staleGraceDays: 10,
    },
    {
      documentFamily: "portfolio" as const,
      label: "Magnum SIF portfolio disclosures",
      listingUrl: "https://www.sbimf.com/magnumsif-portfolios",
      sourceKind: "listing_page" as const,
      discoveryMode: "dynamic" as const,
      expectedCadenceDays: 61,
      staleGraceDays: 14,
    },
    {
      documentFamily: "isid_kim" as const,
      label: "Magnum SIF offer documents / ISID / KIM",
      listingUrl: "https://www.sbimf.com/magnumsif-offer-document-sid-kim",
      sourceKind: "listing_page" as const,
      discoveryMode: "html_links" as const,
      expectedCadenceDays: null,
      staleGraceDays: 30,
    },
    {
      documentFamily: "isid_kim" as const,
      label: "Magnum Equity Ex-Top 100 Long Short Fund ISID",
      listingUrl: "https://www.sbimf.com/docs/default-source/sif-equity-ex-top-long-short-fund-documents/isid---magnum-equity-ex-top-100-long-short-fund.pdf",
      sourceKind: "direct_pdf" as const,
      discoveryMode: "direct" as const,
      expectedCadenceDays: null,
      staleGraceDays: 30,
    },
    {
      documentFamily: "isid_kim" as const,
      label: "Magnum Equity Ex-Top 100 Long Short Fund KIM",
      listingUrl: "https://www.sbimf.com/docs/default-source/sif-equity-ex-top-long-short-fund-documents/kim---magnum-equity-ex-top-100-long-short-fund.pdf",
      sourceKind: "direct_pdf" as const,
      discoveryMode: "direct" as const,
      expectedCadenceDays: null,
      staleGraceDays: 30,
    },
  ],
};

type AdapterSource = {
  listingUrl: string;
  documentFamily: DocumentFamily;
  sourceKind?: "listing_page" | "direct_pdf" | "public_feed" | "manual";
};

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/gi, "/")
    .replace(/&quot;/gi, '"');
}

function stripHtml(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function periodFrom(value: string) {
  const match = value.match(/(january|february|march|april|may|june|july|august|september|october|november|december)[\s_-]*(20\d{2})/i);
  return match ? `${match[1][0].toUpperCase()}${match[1].slice(1).toLowerCase()} ${match[2]}` : undefined;
}

function sortValue(period?: string) {
  if (!period) return Number.NEGATIVE_INFINITY;
  const parsed = new Date(`1 ${period} UTC`);
  return Number.isNaN(parsed.getTime()) ? Number.NEGATIVE_INFINITY : parsed.getTime();
}

function candidatesFromHtml(html: string, source: AdapterSource, requestedPeriod?: string) {
  const candidates = new Map<string, SifDocumentCandidate>();
  const anchorPattern = /<a\b([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html)) !== null) {
    const rawHref = decodeHtml(match[2]);
    if (!/\.pdf(?:[?#]|$)/i.test(rawHref)) continue;
    const url = new URL(rawHref, source.listingUrl).toString();
    if (!isApprovedSbiDocumentHost(url)) continue;
    const anchorText = stripHtml(match[4]);
    const surrounding = html.slice(Math.max(0, match.index - 500), Math.min(html.length, match.index + match[0].length + 500));
    const label = anchorText || stripHtml(surrounding).slice(0, 240) || new URL(url).pathname.split("/").at(-1) || "Official SBI SIF PDF";
    if (source.documentFamily === "factsheet" && !/magnum\s+sif\s+schemes\s+factsheet/i.test(label)) continue;
    const periodLabel = periodFrom(`${label} ${url}`);
    if (requestedPeriod && periodLabel !== requestedPeriod) continue;
    candidates.set(url, {
      title: label,
      url,
      sourcePageUrl: source.listingUrl,
      documentFamily: source.documentFamily,
      periodLabel,
    });
  }

  return Array.from(candidates.values()).sort((left, right) => sortValue(right.periodLabel) - sortValue(left.periodLabel));
}

export function isApprovedSbiDocumentHost(value: string, allowedDomains = SBI_MAGNUM_SIF_PROVIDER.allowedDomains) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const hostname = url.hostname.toLowerCase();
    return allowedDomains.some((domain) => {
      const lower = domain.toLowerCase();
      if (lower.startsWith("*.")) return hostname === lower.slice(2) || hostname.endsWith(`.${lower.slice(2)}`);
      return hostname === lower;
    });
  } catch {
    return false;
  }
}

export async function discoverSbiCandidates(source: AdapterSource, requestedPeriod?: string): Promise<SifDocumentCandidate[]> {
  if (source.sourceKind === "direct_pdf") {
    return [{
      title: new URL(source.listingUrl).pathname.split("/").at(-1)?.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ") || "Official SBI SIF PDF",
      url: source.listingUrl,
      sourcePageUrl: source.listingUrl,
      documentFamily: source.documentFamily,
      periodLabel: periodFrom(source.listingUrl),
    }].filter((candidate) => !requestedPeriod || candidate.periodLabel === requestedPeriod);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const factsheetRequest = source.documentFamily === "factsheet";
    const response = await fetch(factsheetRequest ? "https://www.sbimf.com/ajaxcall/CMS/GetRecentSIFFactSheets" : source.listingUrl, {
      method: factsheetRequest ? "POST" : "GET",
      headers: {
        "User-Agent": "1FinanceSIFReader/1.0 (+document retrieval)",
        Accept: "text/html,application/xhtml+xml",
        ...(factsheetRequest ? { "Content-Type": "application/json;charset=utf-8" } : {}),
      },
      body: factsheetRequest ? "{}" : undefined,
      signal: controller.signal,
      redirect: "follow",
    });
    if (!response.ok) throw new Error(`Official source returned ${response.status}`);
    const html = await response.text();
    return candidatesFromHtml(html, source, requestedPeriod);
  } finally {
    clearTimeout(timeout);
  }
}
