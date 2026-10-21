import { createHash } from "node:crypto";
import { PDFParse } from "pdf-parse";
import type { ParsedEvidenceFact, ParsedSifDocument, ParsedStrategySection, PdfTextPage } from "./contracts";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STRATEGY_HEADING = /^(?:Magnum\s+)?[A-Za-z0-9&/(),.'’–—\- ]{3,150}\bLong[-–—\s]+Short\s+Fund$/i;

export function normalizeSifName(value: string) {
  return value
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function cleanLine(value: string) {
  return value.replace(/[•●▪◆]/g, " ").replace(/\s+/g, " ").trim();
}

function firstUsefulLine(value: string) {
  return value
    .split("\n")
    .map(cleanLine)
    .find((line) => line.length >= 8 && line.length <= 500);
}

function truncateEvidence(value: string, max = 900) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= max ? compact : `${compact.slice(0, max - 1)}…`;
}

function pageSlice(pages: PdfTextPage[], start: number, end: number) {
  return pages.filter((page) => page.number >= start && page.number <= end);
}

function detectDocumentDate(text: string) {
  const head = text.slice(0, 16_000);
  const match = head.match(/(?:as\s+on|data\s+(?:as\s+)?of|factsheet\s*(?:as\s+)?on)?\s*(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2})/i);
  if (!match) return undefined;

  const label = match[1].replace(/\s+/g, " ").trim();
  const parsed = /^\d{1,2}\s/.test(label)
    ? new Date(`${label} UTC`)
    : new Date(`1 ${label} UTC`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return { date: parsed, label };
}

function isStrategyHeading(line: string) {
  return STRATEGY_HEADING.test(line) && !/^(?:the|a|an)\s/i.test(line);
}

/**
 * PDFs often repeat a strategy name in navigation, campaign copy, and the factsheet body.
 * This key removes only known presentational prefixes; it never invents a new strategy name.
 */
function strategyIdentityKey(line: string) {
  const compact = normalizeSifName(line)
    .replace(/[–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (/^(?:\d+\s+)?(?:qsif\s+)?(?:equity\s+)?ex\s+top\s+100\s+long\s+short\s+fund$/i.test(compact) || /^(?:\d+\s+)?100\s+long\s+short\s+fund$/i.test(compact)) {
    return "equity ex top 100 long short fund";
  }
  if (/^(?:qsif\s+)?equity\s+long\s+short\s+fund$/i.test(compact)) return "equity long short fund";
  if (/^(?:qsif\s+)?(?:india[’']s\s+1st\s+)?hybrid\s+long\s+short\s+fund(?:\s+india[’']s\s+1st\s+hybrid\s+long\s+short\s+fund)?$/i.test(compact)) {
    return "hybrid long short fund";
  }

  let value = compact
    .replace(/^\d+\s+/, "")
    .replace(/^india[’']?s\s+\d+(?:st|nd|rd|th)\s+/, "")
    .replace(/^(?:qsif|magnum)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
  return value;
}

function headingQuality(line: string) {
  let score = 0;
  if (/^(?:qsif|magnum)\s+/i.test(line)) score += 4;
  if (/^\d+\s+|^india[’']?s\s+\d+(?:st|nd|rd|th)\s+/i.test(line)) score -= 4;
  if (/india[’']?s\s+1st/i.test(line)) score -= 2;
  if (/equity|debt|hybrid|long[-–—\s]+short/i.test(line)) score += 1;
  return score;
}

function labelledFact(section: ParsedStrategySection, pages: PdfTextPage[], key: string, labels: RegExp, options: { max?: number; confidence?: number; reject?: RegExp; accept?: RegExp } = {}): ParsedEvidenceFact | undefined {
  const sectionPages = pageSlice(pages, section.pageStart, section.pageEnd);
  for (const page of sectionPages) {
    const expression = new RegExp(labels.source, labels.flags.includes("g") ? labels.flags : `${labels.flags}g`);
    for (const match of page.text.matchAll(expression)) {
      const raw = match[1] ?? "";
      const value = raw
        .replace(/\s+/g, " ")
        .replace(/(?:\b(?:benchmark|risk(?:\s+band)?|fund\s+manager|investment\s+objective|portfolio|performance)\b\s*:?).*$/i, "")
        .trim();
      if (value.length < 3 || options.reject?.test(value) || (options.accept && !options.accept.test(value))) continue;
      const quote = firstUsefulLine(match[0]) ?? value;
      return {
        key,
        valueText: value.slice(0, options.max ?? 480),
        pageNumber: page.number,
        quote: truncateEvidence(quote),
        evidenceType: "text",
        confidence: options.confidence ?? 96,
      };
    }
  }
  return undefined;
}

function allocationFacts(section: ParsedStrategySection, pages: PdfTextPage[]) {
  const facts: ParsedEvidenceFact[] = [];
  const sectionPages = pageSlice(pages, section.pageStart, section.pageEnd);
  for (const page of sectionPages) {
    const lines = page.text.split("\n").map(cleanLine).filter(Boolean);
    const headingIndex = lines.findIndex((line) => /(?:asset\s+allocation|asset\s+mix|sector\s+allocation|industry\s+allocation|sector\s+wise)/i.test(line));
    if (headingIndex < 0) continue;
    const heading = lines[headingIndex];
    const type = /sector|industry/i.test(heading) ? "sector_exposure" : "asset_allocation";
    const rows = lines.slice(headingIndex + 1, headingIndex + 26)
      .map((line) => {
        const match = line.match(/^(.{2,100}?)\s+(\d{1,3}(?:\.\d{1,4})?)\s*%$/);
        if (!match) return undefined;
        const label = cleanLine(match[1]);
        const percentage = Number(match[2]);
        if (!label || !Number.isFinite(percentage) || percentage < 0 || percentage > 100) return undefined;
        return { label, percentage };
      })
      .filter((row): row is { label: string; percentage: number } => Boolean(row));

    if (rows.length < 2) continue;
    for (const row of rows) {
      facts.push({
        key: type,
        qualifier: row.label,
        valueText: `${row.percentage.toFixed(2)}%`,
        pageNumber: page.number,
        quote: truncateEvidence(`${heading}: ${row.label} ${row.percentage.toFixed(2)}%`),
        evidenceType: "table",
        confidence: 93,
      });
    }
    break;
  }
  return facts;
}

function extractSectionFacts(section: ParsedStrategySection, pages: PdfTextPage[]) {
  const facts: ParsedEvidenceFact[] = [{
    key: "strategy_name",
    valueText: section.heading,
    pageNumber: section.pageStart,
    quote: section.heading,
    evidenceType: "text",
    confidence: 99,
  }];

  const candidates = [
    labelledFact(section, pages, "investment_objective", /investment\s+objective\s*[:\-]?\s*([^\n]{8,700})/i, { max: 600 }),
    labelledFact(section, pages, "benchmark", /benchmark\s*[:\-]?\s*([^\n]{3,300})/i, {
      reject: /^(?:returns?\s*%?|risk\s*band|level|performance|scheme|index\s*:?)$/i,
      accept: /(?:index|nifty|sensex|bse|nse|crisil|bloomberg|msci|ftse|s&p|composite|\btri\b)/i,
    }),
    labelledFact(section, pages, "risk_information", /(?:risk\s*band|riskometer|risk\s+level)\s*[:\-]?\s*([^\n]{3,300})/i),
    labelledFact(section, pages, "total_expense_ratio", /(?:total\s+expense\s+ratio|ter)\s*[:\-]?\s*([^\n]{3,200})/i),
    labelledFact(section, pages, "minimum_investment", /(?:minimum\s+(?:application|investment)|minimum\s+amount)\s*[:\-]?\s*([^\n]{3,300})/i),
    labelledFact(section, pages, "redemption_frequency", /redemption\s+frequency\s*[:\-]?\s*([^\n]{3,300})/i),
    labelledFact(section, pages, "redemption_notice_period", /notice\s+period\s*[:\-]?\s*([^\n]{3,300})/i),
    labelledFact(section, pages, "exit_load", /exit\s+load\s*[:\-]?\s*([^\n]{3,300})/i),
  ].filter((fact): fact is ParsedEvidenceFact => Boolean(fact));

  return [...facts, ...candidates, ...allocationFacts(section, pages)];
}

export async function parseSifPdf(buffer: Buffer): Promise<ParsedSifDocument> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const textResult = await parser.getText();
    const pages = textResult.pages.map((page) => ({ number: page.num, text: page.text ?? "" }));
    const extractedText = pages.map((page) => `\n\n[Page ${page.number}]\n${page.text}`).join("");
    const discovered = new Map<string, { heading: string; pageStart: number; identityKey: string }>();

    for (const page of pages) {
      for (const line of page.text.split("\n").map(cleanLine)) {
        if (!isStrategyHeading(line)) continue;
        const key = strategyIdentityKey(line);
        const existing = discovered.get(key);
        if (!existing) {
          discovered.set(key, { heading: line, pageStart: page.number, identityKey: key });
        } else {
          discovered.set(key, {
            heading: headingQuality(line) > headingQuality(existing.heading) ? line : existing.heading,
            pageStart: Math.min(existing.pageStart, page.number),
            identityKey: key,
          });
        }
      }
    }

    const strategyStarts = Array.from(discovered.values()).sort((left, right) => left.pageStart - right.pageStart);
    const sections: ParsedStrategySection[] = strategyStarts.map((entry, index) => {
      const pageEnd = strategyStarts[index + 1]?.pageStart
        ? Math.max(entry.pageStart, strategyStarts[index + 1].pageStart - 1)
        : pages.at(-1)?.number ?? entry.pageStart;
      const section: ParsedStrategySection = {
        heading: entry.heading,
        normalizedHeading: entry.identityKey,
        pageStart: entry.pageStart,
        pageEnd,
        text: pageSlice(pages, entry.pageStart, pageEnd).map((page) => page.text).join("\n"),
        confidence: 98,
        facts: [],
      };
      section.facts = extractSectionFacts(section, pages);
      return section;
    });

    const period = detectDocumentDate(extractedText);
    const title = firstUsefulLine(pages[0]?.text ?? "");
    return {
      pages,
      extractedText,
      documentDate: period?.date,
      documentDateLabel: period?.label,
      title,
      sections,
    };
  } finally {
    await parser.destroy?.();
  }
}

export function sectionHash(section: ParsedStrategySection) {
  return createHash("sha256").update(`${section.normalizedHeading}:${section.pageStart}:${section.pageEnd}:${section.text}`).digest("hex");
}
