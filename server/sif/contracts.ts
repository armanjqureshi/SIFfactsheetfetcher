export const documentFamilies = [
  "factsheet",
  "portfolio",
  "isid_kim",
  "sai",
  "ter",
  "notice",
  "regulatory",
] as const;

export type DocumentFamily = (typeof documentFamilies)[number];

export type SourceAttestation = "official" | "direct_source" | "user_supplied" | "legacy_import";

export type SifDocumentCandidate = {
  title: string;
  url: string;
  sourcePageUrl: string;
  documentFamily: DocumentFamily;
  periodLabel?: string;
  publishedLabel?: string;
};

export type PdfTextPage = {
  number: number;
  text: string;
};

export type ParsedEvidenceFact = {
  key: string;
  valueText: string;
  qualifier?: string;
  pageNumber: number;
  quote: string;
  evidenceType: "text" | "table";
  confidence: number;
};

export type ParsedStrategySection = {
  heading: string;
  normalizedHeading: string;
  pageStart: number;
  pageEnd: number;
  text: string;
  confidence: number;
  facts: ParsedEvidenceFact[];
};

export type ParsedSifDocument = {
  pages: PdfTextPage[];
  extractedText: string;
  documentDate?: Date;
  documentDateLabel?: string;
  title?: string;
  sections: ParsedStrategySection[];
};

export const comparisonStatuses = [
  "Comparable",
  "Partially comparable",
  "Not comparable",
  "Different document periods",
  "Different source types",
  "Different provider taxonomies",
] as const;

export type ComparisonStatus = (typeof comparisonStatuses)[number];
