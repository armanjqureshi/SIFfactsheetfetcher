import { ExternalLink, FileText } from "lucide-react";

type EvidenceButtonProps = {
  pageUrl?: string | null;
  pageNumber: number;
  compact?: boolean;
};

export function EvidenceButton({ pageUrl, pageNumber, compact = false }: EvidenceButtonProps) {
  if (!pageUrl) return <span className="evidence-unavailable">Evidence unavailable</span>;
  return (
    <a className={`evidence-button ${compact ? "compact" : ""}`} href={pageUrl} target="_blank" rel="noreferrer">
      <FileText size={compact ? 13 : 14} />
      <span>{compact ? `p. ${pageNumber}` : `Evidence · page ${pageNumber}`}</span>
      {!compact && <ExternalLink size={12} />}
    </a>
  );
}
