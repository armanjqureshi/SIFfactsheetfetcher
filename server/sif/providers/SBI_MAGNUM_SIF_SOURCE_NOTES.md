# SBI Magnum SIF source notes

The initial provider adapter uses only official `sbimf.com` sources. These implementation notes were verified on 21 October 2026 and should be reviewed when the provider changes its portal.

The factsheet listing is `https://www.sbimf.com/magnumsif-factsheets`. It currently exposes monthly consolidated “All Magnum SIF Schemes Factsheet” PDFs, using a variable Sitefinity path under `https://www.sbimf.com/docs/default-source/sif-scheme-facsheets/`. Slugs vary by month and may include `final`; the adapter must discover listing links rather than synthesizing a latest URL. The September 2026 PDF is `https://www.sbimf.com/docs/default-source/sif-scheme-facsheets/magnum-sif-as-on-september-2026.pdf?sfvrsn=31c9d72b_6` and prints “Investment update Report as on September 30, 2026.”

That PDF is consolidated and contains the strategy headings `MAGNUM HYBRID LONG SHORT FUND` and `MAGNUM EQUITY EX-TOP 100 LONG SHORT FUND`. Printed dates in the PDF are authoritative over filename and listing release labels. Individual metrics can have their own as-of date, so metric-level dates must not be silently substituted with the document date.

The portfolio listing is `https://www.sbimf.com/magnumsif-portfolios`. Its static response exposes a dynamic loading state only. A client-side provider module is at `https://www.sbimf.com/Content/Service/SIFPortfolios.js`; it uses fund and portfolio-frequency inputs. No static direct portfolio-PDF pattern is assumed. Until a candidate can be discovered and validated, the application must show the source as official but currently unavailable and offer controlled direct-PDF/upload fallback.

The offer-document page is `https://www.sbimf.com/magnumsif-offer-document-sid-kim`. It is a disclosure hub rather than a full static offer-document list. Verified official direct documents for the Equity Ex-Top 100 strategy include:

- ISID: `https://www.sbimf.com/docs/default-source/sif-equity-ex-top-long-short-fund-documents/isid---magnum-equity-ex-top-100-long-short-fund.pdf`
- KIM: `https://www.sbimf.com/docs/default-source/sif-equity-ex-top-long-short-fund-documents/kim---magnum-equity-ex-top-100-long-short-fund.pdf`
- Scheme differentiation table: `https://www.sbimf.com/docs/default-source/pdf/sif_-june-2026_scheme-differentiation-table.pdf`

The scheme-differentiation filename is not an authoritative period: the observed PDF contains data as of August 31, 2026. The source registry therefore records provenance and parsed document date separately.

Native page-aware extraction of the September 2026 consolidated factsheet validated `Index: NIFTY 50 Hybrid` for the Hybrid strategy on page 2 and `NIFTY 50 Hybrid Composite` for the Equity Ex-Top 100 strategy on page 6. The PDF also contains generic benchmark/returns table text; the parser must require a recognizable index/benchmark name and withhold bare headers or fragments rather than publishing them.
