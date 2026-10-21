import type { SifDocumentCandidate } from "../contracts";
import { discoverHtmlFactsheetCandidates, isAllowedSourceHost, type HtmlFactsheetSource } from "./genericHtml";

type QsifSource = HtmlFactsheetSource;

/**
 * qSIF’s 2025 selector uses an ASP.NET postback that returns the dated PDF only in browser-rendered form.
 * This is the exact link and period observed from that provider-owned selector on 21 October 2026.
 * It is intentionally a specific evidence-backed archive entry, not a guessed filename pattern.
 */
const VERIFIED_QSIF_ARCHIVE: Omit<SifDocumentCandidate, "sourcePageUrl" | "documentFamily">[] = [
  {
    title: "qsif factsheet — December 2025",
    periodLabel: "December 2025",
    url: "https://www.qsif.com/Admin/Factsheet/qsif_Factsheet_Dec%202025.pdf",
  },
];

export async function discoverQsifCandidates(source: QsifSource, requestedPeriod?: string): Promise<SifDocumentCandidate[]> {
  if (!isAllowedSourceHost(source.listingUrl, source.allowedDomains)) throw new Error("Official qsif listing is not on a configured provider domain");
  const current = await discoverHtmlFactsheetCandidates(source, requestedPeriod);
  const archived = VERIFIED_QSIF_ARCHIVE
    .filter((candidate) => !requestedPeriod || candidate.periodLabel === requestedPeriod)
    .map((candidate) => ({ ...candidate, sourcePageUrl: source.listingUrl, documentFamily: source.documentFamily }));
  const candidates = new Map<string, SifDocumentCandidate>();
  for (const candidate of [...current, ...archived]) candidates.set(candidate.url, candidate);
  return Array.from(candidates.values()).sort((left, right) => {
    const leftDate = left.periodLabel ? new Date(`1 ${left.periodLabel} UTC`).getTime() : 0;
    const rightDate = right.periodLabel ? new Date(`1 ${right.periodLabel} UTC`).getTime() : 0;
    return rightDate - leftDate;
  });
}
