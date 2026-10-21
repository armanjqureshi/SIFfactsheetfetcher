import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, CalendarDays, FileText, ShieldCheck } from "lucide-react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { BrandHeader } from "@/components/sif/BrandHeader";
import { ChatPanel } from "@/components/sif/ChatPanel";
import { EvidenceButton } from "@/components/sif/EvidenceButton";
import { StatusBadge } from "@/components/sif/StatusBadge";
import { trpc } from "@/lib/trpc";

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Not stated";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not stated" : new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function labelFor(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ReaderPage() {
  const auth = useAuth();
  const [, params] = useRoute("/reader/:documentId");
  const documentId = Number(params?.documentId);
  const reader = trpc.sif.reader.useQuery({ documentId: Number.isFinite(documentId) ? documentId : 1 }, { enabled: auth.isAuthenticated && Number.isFinite(documentId), retry: false });
  const [selectedSectionId, setSelectedSectionId] = useState<number>();

  useEffect(() => {
    if (!selectedSectionId && reader.data?.sections[0]) setSelectedSectionId(reader.data.sections[0].id);
  }, [reader.data?.sections, selectedSectionId]);

  if (auth.loading || (auth.isAuthenticated && reader.isLoading)) return <div className="loading-state">Loading immutable document evidence…</div>;
  if (!auth.isAuthenticated) return <main className="signin-hero"><p className="page-kicker">Document reader</p><h1 className="page-title">Sign in to read verified source evidence.</h1><p className="page-lede">The document reader maintains source, section, and page scope for every fact.</p><button className="primary-button" type="button" onClick={startLogin}>Sign in to continue</button></main>;
  if (reader.error) return <main className="app-shell"><Link href="/" className="text-button"><ArrowLeft size={15} /> Back to library</Link><p className="inline-error">{reader.error.message}</p></main>;
  if (!reader.data) return null;

  const data = reader.data;
  const document = data.document.document;
  const activeSection = data.sections.find((section) => section.id === selectedSectionId) ?? data.sections[0];

  return (
    <>
      <BrandHeader userName={auth.user?.name} onLogin={startLogin} onLogout={() => void auth.logout()} />
      <main className="app-shell">
        <Link href="/" className="text-button"><ArrowLeft size={15} /> Document library</Link>
        <div className="reader-metadata" style={{ marginTop: 22 }}>
          <div><span className="scope-chip">{document.scopeLevel.replace(/_/g, " ")}</span><h1>{document.title}</h1><p><CalendarDays size={13} style={{ verticalAlign: "-2px" }} /> Reported as of {formatDate(document.documentDate)} · Last verified {formatDate(document.lastVerifiedAt)} · {data.document.providerName}</p></div>
          <StatusBadge status={document.parseStatus} />
        </div>
        <div className="verification-strip"><ShieldCheck size={18} /><div><strong>Evidence scope: this immutable PDF</strong>Facts below are tied to the selected strategy section. If information is absent or unclear, it is withheld rather than inferred.</div></div>

        <div className="reader-layout">
          <aside className="reader-rail"><span className="rail-label">Strategies in this document</span>{data.sections.length === 0 ? <p className="page-lede">No clear strategy heading was deterministically detected.</p> : data.sections.map((section) => <button key={section.id} type="button" className={`strategy-tab ${section.id === activeSection?.id ? "active" : ""}`} onClick={() => setSelectedSectionId(section.id)}>{section.strategyName ?? section.rawHeading}<small>Pages {section.pageStart}–{section.pageEnd} · Strategy-level</small></button>)}</aside>
          <section className="facts-panel">
            {activeSection ? <>
              <span className="scope-chip">Strategy-level evidence</span>
              <h2 style={{ margin: "10px 0 3px", fontSize: 22, letterSpacing: "-.03em" }}>{activeSection.strategyName ?? activeSection.rawHeading}</h2>
              <p className="page-lede" style={{ marginTop: 0, fontSize: 13 }}>Detected from pages {activeSection.pageStart}–{activeSection.pageEnd}. Values below are presented only where a clear native PDF text receipt was captured.</p>
              {activeSection.facts.length === 0 ? <div className="empty-state"><strong>No facts published for this strategy section.</strong>The selected document does not clearly disclose a supported value through the current deterministic parser.</div> : <ul className="fact-list">{activeSection.facts.map((fact) => <li className="fact-row" key={fact.id}><div className="fact-label"><strong>{labelFor(fact.factKey)}</strong>{fact.qualifier ? fact.qualifier : fact.scopeLevel.replace(/_/g, " ")}</div><div className="fact-value">{fact.valueText ?? "Not disclosed in the selected document"}</div><EvidenceButton pageUrl={fact.evidence[0]?.pageUrl} pageNumber={fact.evidence[0]?.pageNumber ?? activeSection.pageStart} /></li>)}</ul>}
            </> : <div className="empty-state"><FileText size={24} style={{ marginBottom: 9 }} /><strong>No strategy selection is available.</strong>The cached document remains accessible, but no strategy-level evidence can be shown safely.</div>}
          </section>
          <ChatPanel documentId={document.id} sectionId={activeSection?.id} strategyName={activeSection?.strategyName} />
        </div>
      </main>
    </>
  );
}
