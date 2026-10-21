import type { DocumentFamily } from "../contracts";

export type FactsheetAvailability = "verified_available" | "not_verified";

export type OfficialSifSourceDefinition = {
  documentFamily: DocumentFamily;
  label: string;
  listingUrl: string;
  sourceKind: "listing_page" | "direct_pdf" | "public_feed" | "manual";
  discoveryMode: "html_links" | "dynamic" | "direct" | "manual";
  expectedCadenceDays: number | null;
  staleGraceDays: number;
};

export type OfficialSifProviderDefinition = {
  name: string;
  slug: string;
  websiteUrl: string;
  productName: string;
  productNormalizedName: string;
  sifLandingUrl: string;
  factsheetListingUrl?: string;
  factsheetAvailability: FactsheetAvailability;
  factsheetNotes: string;
  evidenceUrls: string[];
  allowedDomains: string[];
  sources?: OfficialSifSourceDefinition[];
};

/** Date on which the source inventory below was directly observed against first-party SIF/AMFI material. */
export const OFFICIAL_SIF_REGISTRY_OBSERVED_AT = new Date("2026-10-21T00:00:00.000Z");

/**
 * Registry verified against provider-owned SIF pages and AMFI SIF ISID/NAV material on 21 October 2026.
 * A blank factsheet URL is intentional: it means no factsheet-specific official endpoint was validated.
 */
export const OFFICIAL_SIF_PROVIDER_REGISTRY: OfficialSifProviderDefinition[] = [
  {
    name: "quant Mutual Fund", slug: "quant-qsif", websiteUrl: "https://quantmutual.com", productName: "qsif", productNormalizedName: "qsif",
    sifLandingUrl: "https://www.qsif.com/", factsheetListingUrl: "https://www.qsif.com/downloads/factsheet", factsheetAvailability: "verified_available",
    factsheetNotes: "Official qsif Factsheet page lists dated monthly PDFs for 2026; its provider-rendered 2025 selector exposed the December 2025 archive PDF. October 2026 was the latest visible file at verification.",
    evidenceUrls: ["https://www.qsif.com/", "https://www.qsif.com/downloads/factsheet", "https://portal.amfiindia.com/spages/S-1.pdf"], allowedDomains: ["qsif.com", "*.qsif.com", "quantmutual.com", "*.quantmutual.com"],
    sources: [{ documentFamily: "factsheet", label: "qsif factsheets", listingUrl: "https://www.qsif.com/downloads/factsheet", sourceKind: "listing_page", discoveryMode: "html_links", expectedCadenceDays: 31, staleGraceDays: 10 }],
  },
  {
    name: "Edelweiss Mutual Fund", slug: "edelweiss-altiva-sif", websiteUrl: "https://www.edelweissmf.com", productName: "Altiva Specialized Investment Fund", productNormalizedName: "altiva specialized investment fund",
    sifLandingUrl: "https://www.edelweissmf.com/altivasif", factsheetListingUrl: "https://www.edelweissmf.com/altivasif/downloads/factsheet", factsheetAvailability: "not_verified",
    factsheetNotes: "A dedicated Factsheet route is listed in official Altiva downloads, but the public response showed a loading state and no dated factsheet file was verifiable.",
    evidenceUrls: ["https://www.edelweissmf.com/altivasif", "https://www.edelweissmf.com/altivasif/downloads/factsheet", "https://portal.amfiindia.com/spages/S-3.pdf"], allowedDomains: ["edelweissmf.com", "*.edelweissmf.com"],
  },
  {
    name: "ITI Mutual Fund", slug: "iti-diviniti-sif", websiteUrl: "https://www.itiamc.com", productName: "Diviniti SIF", productNormalizedName: "diviniti sif",
    sifLandingUrl: "https://sif.itiamc.com/", factsheetAvailability: "not_verified",
    factsheetNotes: "The official Diviniti SIF site has download controls, but no dated official factsheet PDF or factsheet listing was verified.",
    evidenceUrls: ["https://sif.itiamc.com/", "https://portal.amfiindia.com/spages/S-5.pdf"], allowedDomains: ["itiamc.com", "*.itiamc.com"],
  },
  {
    name: "Tata Mutual Fund", slug: "tata-titanium-sif", websiteUrl: "https://www.tatamutualfund.com", productName: "Titanium SIF", productNormalizedName: "titanium sif",
    sifLandingUrl: "https://www.tatamutualfund.com/titanium-sif", factsheetListingUrl: "https://www.tatamutualfund.com/titanium-sif/schemes-related", factsheetAvailability: "not_verified",
    factsheetNotes: "The official Titanium downloads area has a Factsheet section, but the retrieved October 2026 selection returned no factsheets.",
    evidenceUrls: ["https://www.tatamutualfund.com/titanium-sif", "https://www.tatamutualfund.com/titanium-sif/schemes-related", "https://portal.amfiindia.com/spages/S-7.pdf"], allowedDomains: ["tatamutualfund.com", "*.tatamutualfund.com"],
  },
  {
    name: "ICICI Prudential Mutual Fund", slug: "icici-prudential-isif", websiteUrl: "https://www.icicipruamc.com", productName: "iSIF", productNormalizedName: "isif",
    sifLandingUrl: "https://www.isif.icicipruamc.com/", factsheetListingUrl: "https://www.isif.icicipruamc.com/media-center/downloads", factsheetAvailability: "not_verified",
    factsheetNotes: "The official iSIF Downloads screen has a Factsheets tab, but no files were present in the retrieved listing.",
    evidenceUrls: ["https://www.isif.icicipruamc.com/", "https://www.isif.icicipruamc.com/media-center/downloads", "https://portal.amfiindia.com/spages/S-8.pdf"], allowedDomains: ["icicipruamc.com", "*.icicipruamc.com"],
  },
  {
    name: "Bandhan Mutual Fund", slug: "bandhan-arudha-sif", websiteUrl: "https://www.bandhanmutual.com", productName: "Arudha SIF", productNormalizedName: "arudha sif",
    sifLandingUrl: "https://arudhasif.com/", factsheetAvailability: "not_verified",
    factsheetNotes: "Official Arudha SIF material is public, but no factsheet-specific endpoint, current SIF factsheet PDF, or historical factsheet listing was verified.",
    evidenceUrls: ["https://arudhasif.com/", "https://portal.amfiindia.com/spages/S-10.pdf"], allowedDomains: ["arudhasif.com", "*.arudhasif.com", "bandhanmutual.com", "*.bandhanmutual.com"],
  },
  {
    name: "360 ONE Asset Management Limited", slug: "360one-dynasif", websiteUrl: "https://www.360.one", productName: "DynaSIF", productNormalizedName: "dynasif",
    sifLandingUrl: "https://www.360.one/dyna-sif", factsheetAvailability: "not_verified",
    factsheetNotes: "The official DynaSIF route is identified in provider material, but access control prevented public factsheet-page validation.",
    evidenceUrls: ["https://www.360.one/dyna-sif", "https://portal.amfiindia.com/spages/S-11.pdf"], allowedDomains: ["360.one", "*.360.one"],
  },
  {
    name: "Aditya Birla Sun Life Mutual Fund", slug: "absl-apex-sif", websiteUrl: "https://mutualfund.adityabirlacapital.com", productName: "Apex SIF", productNormalizedName: "apex sif",
    sifLandingUrl: "https://apexsif.adityabirlacapital.com/", factsheetAvailability: "not_verified",
    factsheetNotes: "The official Apex SIF domain is identified in provider material, but its public response rejected retrieval; no factsheet endpoint is asserted.",
    evidenceUrls: ["https://apexsif.adityabirlacapital.com/", "https://portal.amfiindia.com/spages/S-13.pdf"], allowedDomains: ["adityabirlacapital.com", "*.adityabirlacapital.com"],
  },
  {
    name: "Franklin Templeton Mutual Fund", slug: "franklin-sapphire-sif", websiteUrl: "https://www.franklintempletonindia.com", productName: "Sapphire SIF", productNormalizedName: "sapphire sif",
    sifLandingUrl: "https://www.franklintempletonindia.com/sapphiresif/", factsheetAvailability: "not_verified",
    factsheetNotes: "The official Sapphire SIF page is public, but no current SIF factsheet PDF or historical factsheet list was verified.",
    evidenceUrls: ["https://www.franklintempletonindia.com/sapphiresif/", "https://portal.amfiindia.com/spages/S-16.pdf"], allowedDomains: ["franklintempletonindia.com", "*.franklintempletonindia.com"],
  },
  {
    name: "The Wealth Company Mutual Fund", slug: "wealth-company-wsif", websiteUrl: "https://www.wealthcompanyamc.in", productName: "WSIF", productNormalizedName: "wsif",
    sifLandingUrl: "https://www.wealthcompanyamc.in/wsif/", factsheetAvailability: "not_verified",
    factsheetNotes: "The official WSIF site has Downloads and statutory areas, but no labeled current or historical SIF factsheet series was verified.",
    evidenceUrls: ["https://www.wealthcompanyamc.in/wsif/", "https://portal.amfiindia.com/spages/S-18.pdf"], allowedDomains: ["wealthcompanyamc.in", "*.wealthcompanyamc.in"],
  },
  {
    name: "Union Mutual Fund", slug: "union-arthaya-sif", websiteUrl: "https://www.unionmf.com", productName: "Arthaya SIF by Union Mutual Fund", productNormalizedName: "arthaya sif by union mutual fund",
    sifLandingUrl: "https://www.unionmf.com/arthayasif", factsheetAvailability: "not_verified",
    factsheetNotes: "Official Arthaya SIF material was verified, but no factsheet-specific endpoint or dated factsheet PDF was found.",
    evidenceUrls: ["https://www.unionmf.com/arthayasif", "https://portal.amfiindia.com/spages/S-20.pdf"], allowedDomains: ["unionmf.com", "*.unionmf.com"],
  },
  {
    name: "HSBC Mutual Fund", slug: "hsbc-redhex-sif", websiteUrl: "https://www.assetmanagement.hsbc.co.in", productName: "RedHex Specialized Investment Fund", productNormalizedName: "redhex specialized investment fund",
    sifLandingUrl: "https://www.assetmanagement.hsbc.co.in/en/redhex-sif", factsheetAvailability: "not_verified",
    factsheetNotes: "The official RedHex SIF site is public, but no factsheet listing/current PDF or historical series was verified.",
    evidenceUrls: ["https://www.assetmanagement.hsbc.co.in/en/redhex-sif", "https://portal.amfiindia.com/spages/S-25.pdf"], allowedDomains: ["assetmanagement.hsbc.co.in", "*.assetmanagement.hsbc.co.in"],
  },
  {
    name: "Mirae Asset Mutual Fund", slug: "mirae-platinum-sif", websiteUrl: "https://www.miraeassetmf.co.in", productName: "Platinum SIF", productNormalizedName: "platinum sif",
    sifLandingUrl: "https://platinumsif.miraeassetmf.co.in/", factsheetAvailability: "not_verified",
    factsheetNotes: "The official Platinum SIF site exposes Forms & Downloads, but no labeled SIF factsheet list, current PDF, or historical series was verified.",
    evidenceUrls: ["https://platinumsif.miraeassetmf.co.in/", "https://portal.amfiindia.com/spages/S-26.pdf"], allowedDomains: ["miraeassetmf.co.in", "*.miraeassetmf.co.in"],
  },
  {
    name: "JioBlackRock Mutual Fund", slug: "jioblackrock-prism-sif", websiteUrl: "https://www.jioblackrockamc.com", productName: "Prism SIF", productNormalizedName: "prism sif",
    sifLandingUrl: "https://www.jioblackrockamc.com/prismsif", factsheetAvailability: "not_verified",
    factsheetNotes: "Official Prism SIF and statutory disclosure pages are public, but no factsheet-specific endpoint or dated SIF factsheet was verified.",
    evidenceUrls: ["https://www.jioblackrockamc.com/prismsif", "https://portal.amfiindia.com/spages/S-27.pdf"], allowedDomains: ["jioblackrockamc.com", "*.jioblackrockamc.com"],
  },
  {
    name: "Kotak Mahindra Mutual Fund", slug: "kotak-infinity-sif", websiteUrl: "https://www.kotakmf.com", productName: "INFINITY Specialized Investment Fund", productNormalizedName: "infinity specialized investment fund",
    sifLandingUrl: "https://www.kotakmf.com/sif", factsheetAvailability: "not_verified",
    factsheetNotes: "The official Kotak SIF path is designated in provider material, but bot management prevented factsheet page validation.",
    evidenceUrls: ["https://www.kotakmf.com/sif", "https://portal.amfiindia.com/spages/S-29.pdf"], allowedDomains: ["kotakmf.com", "*.kotakmf.com"],
  },
  {
    name: "Invesco Mutual Fund", slug: "invesco-summit-sif", websiteUrl: "https://www.invescomutualfund.com", productName: "Summit SIF", productNormalizedName: "summit sif",
    sifLandingUrl: "https://summitsif.invescomutualfund.com/", factsheetAvailability: "not_verified",
    factsheetNotes: "Official Summit SIF literature/forms areas are identified, but no factsheet-specific page, current PDF, or historical list was verified.",
    evidenceUrls: ["https://summitsif.invescomutualfund.com/", "https://portal.amfiindia.com/spages/S-30.pdf", "https://portal.amfiindia.com/spages/S-37.pdf"], allowedDomains: ["invescomutualfund.com", "*.invescomutualfund.com"],
  },
  {
    name: "Mahindra Manulife Mutual Fund", slug: "mahindra-manulife-msif", websiteUrl: "https://www.mahindramanulife.com", productName: "MSIF", productNormalizedName: "msif",
    sifLandingUrl: "https://www.mahindramanulife.com/msif", factsheetAvailability: "not_verified",
    factsheetNotes: "The official MSIF Downloads page was retrieved, but it did not yield a labeled factsheet listing, current factsheet PDF, or history.",
    evidenceUrls: ["https://www.mahindramanulife.com/msif", "https://www.mahindramanulife.com/msif/downloads", "https://portal.amfiindia.com/spages/S-36.pdf"], allowedDomains: ["mahindramanulife.com", "*.mahindramanulife.com"],
  },
  {
    name: "AlphaGrep Mutual Fund", slug: "alphagrep-eminence-sif", websiteUrl: "https://www.alphagrepmf.ai", productName: "Eminence SIF", productNormalizedName: "eminence sif",
    sifLandingUrl: "https://www.eminencesif.ai/", factsheetAvailability: "not_verified",
    factsheetNotes: "The official Eminence SIF site establishes the offering, but no factsheet-specific endpoint, current PDF, or historical listing was verifiable.",
    evidenceUrls: ["https://www.eminencesif.ai/", "https://portal.amfiindia.com/spages/S-38.pdf", "https://www.amfiindia.com/sif/new-fund-offer"], allowedDomains: ["eminencesif.ai", "*.eminencesif.ai", "alphagrepmf.ai", "*.alphagrepmf.ai"],
  },
  {
    name: "Sundaram Mutual Fund", slug: "sundaram-select-sif", websiteUrl: "https://www.sundarammutual.com", productName: "Select SIF", productNormalizedName: "select sif",
    sifLandingUrl: "https://www.sundarammutual.com/selectsif", factsheetAvailability: "not_verified",
    factsheetNotes: "Official Select SIF navigation has disclosures, legal documents, and a scheme summary, but no factsheet-specific source or dated factsheet series was verified.",
    evidenceUrls: ["https://www.sundarammutual.com/selectsif", "https://portal.amfiindia.com/spages/S-40.pdf"], allowedDomains: ["sundarammutual.com", "*.sundarammutual.com"],
  },
];
