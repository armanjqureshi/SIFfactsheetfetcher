import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { ExternalLink, FileUp, Link2, ShieldCheck } from "lucide-react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { BrandHeader } from "@/components/sif/BrandHeader";
import { StatusBadge } from "@/components/sif/StatusBadge";
import { trpc } from "@/lib/trpc";

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Not checked";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

export default function SourcesPage() {
  const auth = useAuth();
  const workspace = trpc.sif.workspace.useQuery(undefined, { enabled: auth.isAuthenticated });
  const utils = trpc.useUtils();
  const [selectedProductId, setSelectedProductId] = useState<number>();
  const [directUrl, setDirectUrl] = useState("");
  const directIngest = trpc.sif.ingestDirectPdf.useMutation({ onSuccess: () => utils.sif.workspace.invalidate() });
  const uploadIngest = trpc.sif.uploadPdf.useMutation({ onSuccess: () => utils.sif.workspace.invalidate() });
  const selectedSource = useMemo(() => workspace.data?.sources.find((source) => source.productId === selectedProductId) ?? null, [selectedProductId, workspace.data?.sources]);
  const selectedProduct = useMemo(() => workspace.data?.products.find((product) => product.id === selectedProductId) ?? null, [selectedProductId, workspace.data?.products]);

  useEffect(() => { if (!selectedProductId && workspace.data?.products[0]) setSelectedProductId(workspace.data.products[0].id); }, [selectedProductId, workspace.data?.products]);
  if (auth.loading || (auth.isAuthenticated && workspace.isLoading)) return <div className="loading-state">Loading official registry…</div>;
  if (!auth.isAuthenticated) return <main className="signin-hero"><p className="page-kicker">Official source registry</p><h1 className="page-title">Sign in to manage source-scoped retrieval.</h1><button className="primary-button" type="button" onClick={startLogin}>Sign in</button></main>;
  if (!workspace.data) return null;

  async function submitDirect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSource || !directUrl.trim()) return;
    await directIngest.mutateAsync({ sourceId: selectedSource.id, url: directUrl.trim() });
    setDirectUrl("");
  }
  async function chooseUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !selectedSource) return;
    const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error("Could not read the selected file")); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file); });
    await uploadIngest.mutateAsync({ sourceId: selectedSource.id, fileName: file.name, base64 });
    event.target.value = "";
  }

  return <><BrandHeader userName={auth.user?.name} onLogin={startLogin} onLogout={() => void auth.logout()} /><main className="app-shell"><p className="page-kicker">Evidence provenance</p><h1 className="page-title">Every SIF provider is visible. Every factsheet claim is qualified.</h1><p className="page-lede">This registry records official provider pages and the result of factsheet-feed verification. A manual file stays user-supplied or direct-source until its source affiliation is technically validated.</p>
    <section><div className="section-heading"><div><h2>All provider records</h2><p>Select a provider to inspect first-party sources or use a controlled PDF fallback.</p></div><span>{workspace.data.products.length} active offerings</span></div><div className="source-table">{workspace.data.products.map((product) => { const available = product.factsheetAvailability === "verified_available"; return <div className={`source-row ${product.id === selectedProductId ? "selected-row" : ""}`} key={product.id}><div><strong>{product.name}</strong><small>{product.providerName}</small></div><div><StatusBadge status={available ? "verified" : "unavailable"} label={available ? "Dated feed verified" : "No verified feed"} /></div><div><small>{product.factsheetNotes}</small>{product.registryVerifiedAt && <small>Source record observed {formatDate(product.registryVerifiedAt)}</small>}</div><div className="source-actions"><a className="text-button" href={product.sifLandingUrl ?? "#"} target="_blank" rel="noreferrer">Official page <ExternalLink size={13} /></a><button type="button" className="secondary-button" onClick={() => setSelectedProductId(product.id)}>Select</button></div></div>; })}</div></section>
    {selectedProduct && selectedSource && <section className="fallback-card"><div><h2><Link2 size={17} style={{ verticalAlign: "-3px", marginRight: 5 }} />{selectedProduct.name}</h2><p>{selectedProduct.factsheetAvailability === "verified_available" ? "A dated official factsheet feed is available in the Library. You can also submit a specific provider-domain PDF here if it is not listed yet." : "No dated official factsheet feed has been verified. Submit only a direct PDF from this provider’s approved domain, or upload the source file. It will not be called official without validation."}</p>{selectedProduct.registryEvidenceUrls.map((url) => <a className="source-evidence-link" key={url} href={url} target="_blank" rel="noreferrer"><ShieldCheck size={13} /> Source evidence <ExternalLink size={12} /></a>)}</div>
      <div><form className="field-stack" onSubmit={submitDirect}><label htmlFor="direct-url">Verified direct-PDF link</label><div className="field-row"><input id="direct-url" className="field-input" type="url" placeholder="https://provider.example/document.pdf" value={directUrl} onChange={(event) => setDirectUrl(event.target.value)} /><button className="secondary-button" type="submit" disabled={directIngest.isPending}>{directIngest.isPending ? "Validating…" : "Validate & cache"}</button></div>{directIngest.error && <span className="inline-error">{directIngest.error.message}</span>}{directIngest.data && <span className="verification-strip"><ShieldCheck size={15} />{directIngest.data.message}</span>}</form><div className="field-stack" style={{ marginTop: 16 }}><label>PDF upload fallback</label><label className="secondary-button" style={{ width: "fit-content" }}><FileUp size={15} />{uploadIngest.isPending ? "Uploading…" : "Choose PDF"}<input hidden type="file" accept="application/pdf,.pdf" onChange={chooseUpload} disabled={uploadIngest.isPending} /></label>{uploadIngest.error && <span className="inline-error">{uploadIngest.error.message}</span>}{uploadIngest.data && <span className="verification-strip"><ShieldCheck size={15} />{uploadIngest.data.message}</span>}</div></div>
    </section>}
  </main></>;
}
