type StatusBadgeProps = {
  status: string;
  label?: string;
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const normalized = status.toLowerCase().replace(/_/g, "-");
  return <span className={`status-badge status-${normalized}`}>{label ?? status.replace(/_/g, " ")}</span>;
}
