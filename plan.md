# 1 Finance SIF Factsheet Reader — Implementation Plan

## Product and delivery boundary

This is a new, isolated web application with its own managed database and object storage. It reuses the Mutual Fund Factsheet Reader’s proven patterns—registry-first retrieval, immutable PDF caching, page-aware parsing, conservative withholding, and document-scoped selection—without changing that application’s code or data model.

The first delivered vertical slice was **SBI Magnum SIF**. The application now maintains an all-provider official SIF catalog, seeded from verified provider pages and AMFI SIF material. Every catalog record states whether a dated provider factsheet feed has actually been verified. Latest and historical factsheet discovery is enabled only for such verified feeds (currently SBI Magnum SIF and quant qsif); providers without a verifiable feed retain their official SIF page, evidence URLs, and a scoped direct-PDF/upload fallback rather than an invented factsheet link.

The application must treat all information as document evidence, not financial advice or general market knowledge. It must return “Not disclosed in the selected document” whenever the strategy, source scope, value, date, or PDF evidence is unclear.

## Application architecture

### Server and persistence

The project uses the initialized React/Express/tRPC/Drizzle stack, with a managed MySQL-compatible database and durable project object storage.

The SIF schema is additive and isolated under `sif_` table names. It models:

- Provider, SIF product, investment strategy, and optional strategy variant for an investment approach, option, or share class.
- Approved provider sources with source family, discovery method, associated official/CDN delivery domains, expected cadence, stale tolerance, and active status.
- Immutable document versions with content SHA-256, type, title, source and resolved URLs, document/as-of/publication dates, retrieved/verified timestamps, cache location, parse status, and supersession links.
- Provenance events for every registry retrieval, direct URL, upload, or manual import. They retain source method, original/final URL, uploader, validation status, and source attestation.
- Strategy sections detected within a document, including page range, raw heading, text content, deterministic extraction method, and confidence.
- Typed facts, field-level evidence receipts, strategy freshness, and effective-dated regulatory rules.

Every SIF fact and section carries one explicit scope: `provider_level`, `product_level`, `strategy_level`, `document_section_level`, or `regulatory_context_level`. This keeps product-wide eligibility/fee rules separate from a strategy portfolio, benchmark, or performance value.

### Source adapters and document lifecycle

`server/sif/providers/` defines a provider adapter contract. A source adapter discovers candidates only from approved official provider listing pages or associated delivery domains. It preserves both a source-listing URL and the resolved PDF URL, validates the PDF signature, checks document identity and reported period when available, and records a failure rather than guessing a replacement document.

The SBI adapter covers the official Magnum SIF factsheet, portfolio, and offer-document/ISID/KIM listing flows. A generic HTML factsheet adapter supports verified provider-owned dated listing pages such as quant qsif. The document store deduplicates identical content by SHA-256, retains historical versions, and records a supersession relationship rather than overwriting files. Other official SIF providers enter the registry with explicit factsheet status and evidence links before their adapter is enabled.

Direct PDF links are validated against an approved provider-associated-domain list, including approved CDN/document hosts. Files that pass technical validation but cannot prove source affiliation are marked direct-source or user-supplied, never official. User uploads are stored through the same immutable pipeline and retain user-supplied provenance.

Freshness is configured per source family, not globally. The reader shows the document as-of date, retrieved date, last verified date, current/stale/unavailable/unverified status, and the reason a prior cached version remains visible after an unsuccessful refresh.

### Deterministic extraction and evidence

Extraction follows this fixed order:

1. Native PDF text extraction with page identity.
2. Deterministic page- and section-aware parsing.
3. OCR only for pages that lack usable native text.
4. Evidence and schema validation.
5. Optional AI assistance for approved difficult layouts only.
6. Grounded answer composition.

An LLM cannot establish strategy names, document dates, percentages, fees, minimum investment, portfolio weights, or page numbers. It may never create a published fact without a deterministic evidence receipt.

The initial deterministic parser detects strategy headings and section ranges, then extracts only clearly supported facts such as strategy identity, stated objective, benchmark, risk language, disclosed asset allocation, portfolio/sector rows, fee/expense references, subscription/redemption terms, notice period, and dates. Each fact stores an exact PDF page, quoted/source text, extraction method, confidence, and stable evidence identifier. Ambiguous values are withheld.

The application exposes stable evidence routes rather than persisting temporary object-storage URLs. The viewer generates a safe link to the cached PDF and exact page when the user presses an Evidence button.

### Reader, comparison, and chat

The primary reader scope is provider → document family → immutable document version → strategy section. Changing document version resets the selected strategy, evidence view, chat evidence scope, and comparison selection as needed.

The comparison API compares strategy-plus-document-version pairs. It returns source period, source family, scope, evidence, and one visible status per metric: **Comparable**, **Partially comparable**, **Not comparable**, **Different document periods**, **Different source types**, or **Different provider taxonomies**. Missing values remain “Not disclosed,” not zero.

The grounded chatbot is introduced only after evidence-backed fact retrieval is active. It receives immutable document/section IDs and selected evidence chunks, produces only answers with evidence IDs, and is validated before display. Questions outside the selected source scope receive a concise withholding response. Chat citations are rendered as clickable document-and-page evidence controls.

Regulatory context is stored separately in effective-dated, evidence-backed `sif_regulatory_rules` records. The interface shows effective date, scope, source document, and page for regulatory facts such as investment thresholds; these rules are never hard-coded in prompts or static claims.

There is no user-facing review queue. Low-confidence values are withheld with a clear message. Administrative diagnostics can be added later without exposing unreviewed outputs to readers.

## Visual design

The product will use the requested 1 Finance editorial brand rather than copy the attached mutual-fund project’s dark navy/gold styling.

- **Design Movement:** Evidence-led financial editorial, combining a calm research desk with the scanability of a well-designed factsheet.
- **Core Principles:** Put document date and source status before claims; reveal detail progressively; make evidence one action away; keep all risk and uncertainty language calm and literal.
- **Color Philosophy:** A warm light-neutral reading surface makes dense PDF-derived data feel less intimidating. Purple is reserved for selection, action, and confirmed source context; cool greys separate source layers without looking like a trading terminal.
- **Layout Paradigm:** A document rail on the left leads into a wide editorial reader, with a persistent evidence/chat utility rail on larger screens. Mobile collapses these rails into ordered reading sections.
- **Signature Elements:** A slim verification strip with as-of and last-verified dates; purple page-reference pills; section labels that state scope, such as “Strategy-level” or “Product-level.”
- **Interaction Philosophy:** Selecting a source or strategy explicitly changes the evidence scope and visibly resets dependent results. Evidence opens in context rather than being buried in a references list.
- **Animation:** Use short, restrained 140–180ms fades and layout transitions for source loading and evidence panels. Never animate risk, performance, or numbers in a way that suggests live market movement.
- **Typography System:** Fira Sans throughout. Dense fact labels use small semibold caps; values use a clear medium weight; editorial summaries use a comfortable 16px line height; document metadata stays compact but readable.
- **Brand Essence:** A clear, page-cited SIF document reader for investors who need source-backed answers instead of financial guesswork. Personality: precise, calm, transparent.
- **Brand Voice:** “Read the source, not an assumption.” “This detail is not clearly disclosed in the selected document.”
- **Wordmark & Logo:** A restrained “1 Finance” wordmark paired with a small open-document mark formed from a purple page corner and a single evidence dot.
- **Signature Brand Color:** A deep editorial purple used for evidence controls, selected source state, and primary actions.

No decorative imagery is needed for this document-heavy internal reader. Visual hierarchy will come from typography, source cards, evidence marks, and whitespace.

## Project structure

```text
client/src/
  pages/                 Library, reader, comparison, source/admin and evidence views
  components/sif/        Scope strip, document timeline, facts grid, evidence button, status badges, chat panel
  lib/                   tRPC hooks, stable presentation helpers, comparison status helpers
  index.css              1 Finance light-neutral/Fira Sans design tokens
server/
  routers/sif.ts         Dedicated SIF tRPC API surface
  sif/
    contracts.ts         Runtime schemas and enums shared by service boundaries
    repository.ts        Drizzle reads/writes for SIF domain data
    seed.ts              Idempotent SBI provider/product/source seed
    providers/sbi.ts     Official SBI Magnum SIF source adapter
    ingestion.ts         Candidate retrieval, validation, hash, cache, provenance, and freshness updates
    parser.ts            Page-aware deterministic strategy/section/fact parser
    evidence.ts          Stable evidence-link and evidence-receipt helpers
    comparison.ts        Explicit comparison-status decisions
    chat.ts              Citation-enforced retrieval and answer validation, added after facts are available
drizzle/
  schema.ts              User table plus isolated sif_* tables
  migrations/            Generated additive database migrations
client/public/
  manus-routes.json      Current user-facing route manifest
plan.md                  Approved implementation/design decisions
TODO.md                  Outcome-based delivery backlog
```

## Material constraints and decisions

- Use the managed database and durable object storage; do not store source PDFs only on container disk or in browser memory.
- Preserve the existing app’s authentication pattern through the new starter’s Manus OAuth/session integration.
- Do not use third-party factsheet aggregators or URL guessing to call an SIF document official.
- Do not publish factual values without a selected document, explicit scope, and page evidence.
- Do not label a provider as factsheet-discoverable until its official dated PDF feed is directly verified.
- Do not make a production publication or alter the Mutual Fund application as part of this slice.
