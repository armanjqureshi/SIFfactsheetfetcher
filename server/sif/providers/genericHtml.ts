import type { DocumentFamily, SifDocumentCandidate } from "../contracts";

export type HtmlFactsheetSource = {
  listingUrl: string;
  documentFamily: DocumentFamily;
  providerName: string;
  productName: string;
  allowedDomains: string[];
};

function decodeHtml(value: string) {
  return value.replace(/&amp;/gi, "&").replace(/&#x2F;/gi, "/").replace(/&#47;/gi, "/").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
}
function stripHtml(value: string) { return decodeHtml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()); }
export function isAllowedSourceHost(value: string, domains: string[]) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    return domains.some((domain) => {
      const normalized = domain.toLowerCase();
      const host = url.hostname.toLowerCase();
      return normalized.startsWith("*.") ? host === normalized.slice(2) || host.endsWith(`.${normalized.slice(2)}`) : host === normalized;
    });
  } catch { return false; }
}
function periodFrom(value: string) {
  const match = value.match(/(january|february|march|april|may|june|july|august|september|october|november|december)[\s_\-/]*(20\d{2})/i);
  return match ? `${match[1][0].toUpperCase()}${match[1].slice(1).toLowerCase()} ${match[2]}` : undefined;
}
function dateSortValue(period?: string) {
  if (!period) return Number.NEGATIVE_INFINITY;
  const date = new Date(`1 ${period} UTC`);
  return Number.isNaN(date.getTime()) ? Number.NEGATIVE_INFINITY : date.getTime();
}
function rowContext(html: string, anchorIndex: number, anchorLength: number) {
  const start = html.lastIndexOf("<tr", anchorIndex);
  const end = html.indexOf("</tr>", anchorIndex + anchorLength);
  return start >= 0 && end >= 0 ? html.slice(start, end + 5) : html.slice(Math.max(0, anchorIndex - 480), Math.min(html.length, anchorIndex + anchorLength + 480));
}

/** Extract dated rows only. Other PDFs such as bank forms must never become factsheet candidates. */
export function parseDatedHtmlFactsheetCandidates(html: string, source: HtmlFactsheetSource, requestedPeriod?: string): SifDocumentCandidate[] {
  const candidates = new Map<string, SifDocumentCandidate>();
  const anchors = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchors)) {
    const rawHref = decodeHtml(match[1]);
    if (!/\.pdf(?:[?#]|$)/i.test(rawHref)) continue;
    const url = new URL(rawHref, source.listingUrl).toString();
    if (!isAllowedSourceHost(url, source.allowedDomains)) continue;
    const context = stripHtml(rowContext(html, match.index ?? 0, match[0].length));
    const periodLabel = periodFrom(`${context} ${url}`);
    if (!periodLabel || (requestedPeriod && periodLabel !== requestedPeriod)) continue;
    const anchorText = stripHtml(match[2]).replace(/^pdf\s*icon$/i, "").trim();
    candidates.set(url, {
      title: /factsheet/i.test(context) ? context.slice(0, 240) : `${source.productName} factsheet — ${periodLabel}`,
      url,
      sourcePageUrl: source.listingUrl,
      documentFamily: source.documentFamily,
      periodLabel,
      publishedLabel: anchorText || undefined,
    });
  }
  return Array.from(candidates.values()).sort((left, right) => dateSortValue(right.periodLabel) - dateSortValue(left.periodLabel));
}

/** Discover dated PDFs only from an approved provider-owned factsheet listing page. */
export async function discoverHtmlFactsheetCandidates(source: HtmlFactsheetSource, requestedPeriod?: string): Promise<SifDocumentCandidate[]> {
  if (!isAllowedSourceHost(source.listingUrl, source.allowedDomains)) throw new Error("Official listing is not on a configured provider domain");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(source.listingUrl, { headers: { "User-Agent": "1FinanceSIFReader/1.0 (+official factsheet retrieval)", Accept: "text/html,application/xhtml+xml" }, signal: controller.signal, redirect: "follow" });
    if (!response.ok) throw new Error(`Official listing returned ${response.status}`);
    return parseDatedHtmlFactsheetCandidates(await response.text(), source, requestedPeriod);
  } finally { clearTimeout(timeout); }
}
