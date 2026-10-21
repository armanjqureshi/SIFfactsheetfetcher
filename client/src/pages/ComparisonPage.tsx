import { useEffect, useState } from "react";
import { AlertTriangle, Scale } from "lucide-react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { BrandHeader } from "@/components/sif/BrandHeader";
import { EvidenceButton } from "@/components/sif/EvidenceButton";
import { StatusBadge } from "@/components/sif/StatusBadge";
import { trpc } from "@/lib/trpc";

const facts = ["benchmark", "investment_objective", "total_expense_ratio", "exit_load", "minimum_investment"];

type ComparisonItem = {
  valueText: string | null;
  qualifier: string | null;
  sourceFamily: string;
  documentDate: Date | null;
  evidence: Array<{ id: number; pageNumber: number; pageUrl?: string }>;
} | null;

function labelFor(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: Date | string | null | undefined) {
  return value ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "Not stated";
}

function ComparisonSide({ label, item }: { label: string; item: ComparisonItem }) {
  return <section className="comparison-card"><h3>{label}</h3>{item ? <>
    <StatusBadge status={item.sourceFamily} />
    <p className="comparison-value" style={{ marginTop: 14 }}>{item.valueText ?? "Not disclosed"}</p>
    <p style={{ color: "var(--muted-ink)", fontSize: 12 }}>{formatDate(item.documentDate)}{item.qualifier ? ` · ${item.qualifier}` : ""}</p>
    {item.evidence.map((evidence) => <EvidenceButton key={evidence.id} pageUrl={evidence.pageUrl} pageNumber={evidence.pageNumber} compact />)}
  </> : <p className="comparison-value">Not disclosed in the selected document.</p>}</section>;
}

export default function ComparisonPage() {
  const auth = useAuth();
  const workspace = trpc.sif.workspace.useQuery(undefined, { enabled: auth.isAuthenticated });
  const [leftId, setLeftId] = useState<number>();
  const [rightId, setRightId] = useState<number>();
  const [factKey, setFactKey] = useState("benchmark");

  useEffect(() => {
    const docs = workspace.data?.documents ?? [];
    if (!leftId && docs[0]) setLeftId(docs[0].id);
    if (!rightId && docs[1]) setRightId(docs[1].id);
  }, [leftId, rightId, workspace.data?.documents]);

  const comparison = trpc.sif.compareFact.useQuery({ leftDocumentId: leftId ?? 1, rightDocumentId: rightId ?? 1, factKey }, {
    enabled: auth.isAuthenticated && Boolean(leftId) && Boolean(rightId) && leftId !== rightId,
    retry: false,
  });

  if (auth.loading || (auth.isAuthenticated && workspace.isLoading)) return <div className="loading-state">Preparing comparison…</div>;
  if (!auth.isAuthenticated) return <main className="signin-hero"><p className="page-kicker">Source-aware comparison</p><h1 className="page-title">Sign in to compare specific document versions.</h1><button className="primary-button" type="button" onClick={startLogin}>Sign in</button></main>;
  const documents = workspace.data?.documents ?? [];

  return <>
    <BrandHeader userName={auth.user?.name} onLogin={startLogin} onLogout={() => void auth.logout()} />
    <main className="app-shell">
      <p className="page-kicker">Multi-strategy comparison</p>
      <h1 className="page-title">Compare the documents, not a blended data feed.</h1>
      <p className="page-lede">Each side remains tied to its source family, reporting period, and page evidence. Missing values remain not disclosed.</p>
      {documents.length < 2 ? <div className="empty-state" style={{ marginTop: 30 }}><Scale size={24} style={{ marginBottom: 9 }} /><strong>Cache two document versions to compare.</strong>Use the Library to cache a current and historical factsheet, or an additional official document source. No comparison is implied with only one selected PDF.</div> : <>
        <div className="comparison-controls">
          <label>Left document<select className="field-select" value={leftId} onChange={(event) => setLeftId(Number(event.target.value))}>{documents.map((doc) => <option key={doc.id} value={doc.id}>{doc.title} · {formatDate(doc.documentDate)}</option>)}</select></label>
          <label>Right document<select className="field-select" value={rightId} onChange={(event) => setRightId(Number(event.target.value))}>{documents.map((doc) => <option key={doc.id} value={doc.id}>{doc.title} · {formatDate(doc.documentDate)}</option>)}</select></label>
          <label>Metric<select className="field-select" value={factKey} onChange={(event) => setFactKey(event.target.value)}>{facts.map((fact) => <option key={fact} value={fact}>{labelFor(fact)}</option>)}</select></label>
        </div>
        {comparison.isLoading && <p className="page-lede">Checking metric scope and evidence…</p>}
        {comparison.error && <p className="inline-error">{comparison.error.message}</p>}
        {comparison.data && <>
          <div className="verification-strip"><AlertTriangle size={17} /><div><strong>Comparability: {comparison.data.status}</strong>This status is calculated from document family, reporting period, disclosure availability, and provider taxonomy—not from a visual side-by-side layout.</div></div>
          <div className="comparison-grid" style={{ marginTop: 16 }}>
            <ComparisonSide label="Left document" item={comparison.data.left} />
            <ComparisonSide label="Right document" item={comparison.data.right} />
          </div>
        </>}
      </>}
    </main>
  </>;
}
