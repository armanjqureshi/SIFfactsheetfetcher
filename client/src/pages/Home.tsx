import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, CalendarDays, Database, ExternalLink, FileClock, ShieldCheck } from "lucide-react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { BrandHeader } from "@/components/sif/BrandHeader";
import { StatusBadge } from "@/components/sif/StatusBadge";

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Not stated";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not stated" : new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export default function Home() {
  const auth = useAuth();
  const [selectedSourceId, setSelectedSourceId] = useState<number>();
  const workspace = trpc.sif.workspace.useQuery(undefined, { enabled: auth.isAuthenticated });
  const utils = trpc.useUtils();
  const ingest = trpc.sif.ingestOfficialCandidate.useMutation({ onSuccess: () => utils.sif.workspace.invalidate() });
  const discoverableSources = useMemo(() => (workspace.data?.sources ?? []).filter((source) => source.sourceKind !== "manual"), [workspace.data?.sources]);
  const discovery = trpc.sif.discover.useQuery({ sourceId: selectedSourceId ?? 1 }, { enabled: auth.isAuthenticated && Boolean(selectedSourceId), retry: false });

  useEffect(() => {
    if (!selectedSourceId && discoverableSources[0]) setSelectedSourceId(discoverableSources[0].id);
  }, [discoverableSources, selectedSourceId]);

  if (auth.loading || (auth.isAuthenticated && workspace.isLoading)) return <div className="loading-state">Loading evidence workspace…</div>;
  if (!auth.isAuthenticated) return <main className="signin-hero"><p className="page-kicker">1 Finance · SIF research</p><h1 className="page-title">Read the source, not an assumption.</h1><p className="page-lede">Sign in to retrieve official SIF documents, preserve immutable PDF evidence, and work only from page-cited facts.</p><button className="primary-button" type="button" onClick={startLogin}>Sign in to open the reader</button></main>;
  if (workspace.error || !workspace.data) return <main className="app-shell"><p className="inline-error">{workspace.error?.message ?? "The SIF workspace could not be loaded."}</p></main>;

  const data = workspace.data;
  const selectedSource = data.sources.find((source) => source.id === selectedSourceId);
  const availableFactsheets = data.products.filter((product) => product.factsheetAvailability === "verified_available");

  return <>
    <BrandHeader userName={auth.user?.name} onLogin={startLogin} onLogout={() => void auth.logout()} />
    <main className="app-shell">
      <p className="page-kicker">Official SIF document library</p>
      <h1 className="page-title">Evidence-led factsheets for every verified SIF provider.</h1>
      <p className="page-lede">The catalog contains {data.products.length} verified SIF offerings. A factsheet is discoverable only when its provider has an official dated PDF feed; other providers remain visible with their source evidence and a controlled document fallback.</p>
      <div className="verification-strip"><ShieldCheck size={18} /><div><strong>Evidence-first operating rule</strong>Unsupported values remain withheld. A missing official factsheet is stated as missing; it is never replaced with an inferred URL, a general mutual-fund report, or third-party data.</div></div>

      <section>
        <div className="section-heading"><div><h2>All official SIF offerings</h2><p>{availableFactsheets.length} verified dated factsheet feeds · {data.products.length - availableFactsheets.length} providers awaiting a verifiable feed</p></div><span>{data.products.length} products</span></div>
        <div className="provider-directory">
          {data.products.map((product) => {
            const isAvailable = product.factsheetAvailability === "verified_available";
            const source = discoverableSources.find((item) => item.productId === product.id && item.documentFamily === "factsheet");
            return <article className="provider-card" key={product.id}>
              <div className="source-card-head"><div><span className="provider-name">{product.providerName}</span><h3>{product.name}</h3></div><StatusBadge status={isAvailable ? "verified" : "unavailable"} label={isAvailable ? "Dated feed verified" : "No verified feed"} /></div>
              <p>{product.factsheetNotes}</p>
              <footer>
                <a href={product.sifLandingUrl ?? "#"} target="_blank" rel="noreferrer">Official SIF page <ExternalLink size={12} /></a>
                {source ? <button className="text-button provider-action" type="button" onClick={() => setSelectedSourceId(source.id)}>View factsheets <ArrowRight size={13} /></button> : <Link className="text-button provider-action" href="/sources">Use PDF fallback <ArrowRight size={13} /></Link>}
              </footer>
            </article>;
          })}
        </div>
      </section>

      <section>
        <div className="section-heading"><div><h2>Verified factsheet sources</h2><p>Only provider-controlled, dated listing pages appear here for automated retrieval.</p></div><span>{discoverableSources.filter((source) => source.documentFamily === "factsheet").length} factsheet feeds</span></div>
        <div className="source-grid">
          {discoverableSources.map((source) => <button key={source.id} className={`source-card ${source.id === selectedSourceId ? "selected" : ""}`} type="button" onClick={() => setSelectedSourceId(source.id)}>
            <div className="source-card-head"><h3>{source.label}</h3><StatusBadge status={source.lastCheckedAt ? "verified" : "unverified"} label={source.lastCheckedAt ? "Checked" : "Not checked"} /></div>
            <p>{source.providerName} · {source.documentFamily.replace("_", " ")}<br />Last checked: {formatDate(source.lastCheckedAt)}</p>
            <footer><span>Discover documents</span><ArrowRight size={15} /></footer>
          </button>)}
        </div>
        {selectedSource && <div className="discovery-panel">
          <div className="discovery-header"><div><h3>{selectedSource.label}</h3><p>Only candidates returned by this official source can be marked official. Direct links and uploads retain separate provenance.</p></div><StatusBadge status={selectedSource.documentFamily} /></div>
          {discovery.isLoading && <p className="page-lede">Checking the official source…</p>}
          {discovery.error && <p className="inline-error">{discovery.error.message}</p>}
          {!discovery.isLoading && discovery.data?.length === 0 && <div className="empty-state"><strong>No validated PDF candidates are available through this source right now.</strong>Use the Official sources page for the controlled direct-PDF or upload fallback; the source remains unavailable rather than guessed.</div>}
          {discovery.data && discovery.data.length > 0 && <ul className="candidate-list">{discovery.data.map((candidate) => <li key={candidate.url}><div className="candidate-copy"><strong>{candidate.title}</strong><small>{candidate.periodLabel ?? "Period not stated in listing"} · Provider-listing discovery</small></div><button className="secondary-button" type="button" disabled={ingest.isPending} onClick={() => ingest.mutate({ sourceId: selectedSource.id, candidateUrl: candidate.url })}>{ingest.isPending ? "Caching…" : "Cache & extract"}</button></li>)}</ul>}
          {ingest.error && <p className="inline-error">{ingest.error.message}</p>}
          {ingest.data && <p className="verification-strip"><Database size={16} />{ingest.data.message}</p>}
        </div>}
      </section>

      <section>
        <div className="section-heading"><div><h2>Cached documents</h2><p>Immutable PDFs already available for page-cited reading.</p></div><span>{data.documents.length} cached</span></div>
        {data.documents.length === 0 ? <div className="empty-state"><strong>No document is cached yet.</strong>Select a verified provider source above and cache an official file to begin extraction.</div> : <div className="document-grid">{data.documents.map((document) => <Link key={document.id} className="document-card" href={`/reader/${document.id}`}><div className="document-meta"><FileClock size={13} /> {document.documentFamily.replace("_", " ")} <StatusBadge status={document.freshnessStatus} /></div><h3>{document.title}</h3><p className="document-meta"><CalendarDays size={13} /> As of {formatDate(document.documentDate)} · verified {formatDate(document.lastVerifiedAt)}</p><p className="document-meta" style={{ textTransform: "none", letterSpacing: 0 }}>{document.freshnessReason}</p><footer>Open reader <ArrowRight size={15} /></footer></Link>)}</div>}
      </section>
    </main>
  </>;
}
