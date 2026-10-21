export function evidencePageLink(stableFileUrl: string | null | undefined, pageNumber: number) {
  if (!stableFileUrl || pageNumber < 1) return undefined;
  return `${stableFileUrl}#page=${pageNumber}`;
}

export function withEvidencePage<T extends { pageNumber: number }>(item: T, stableFileUrl: string | null | undefined) {
  return { ...item, pageUrl: evidencePageLink(stableFileUrl, item.pageNumber) };
}
