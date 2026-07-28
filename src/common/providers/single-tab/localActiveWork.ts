// Active work registry - features register their own sources lazily (chat via ConversationsManager,
// ramble capture, ...), so this file depends on nothing and the arrows point feature -> infra

export interface LocalActiveWorkSnapshot {
  ongoingOperations: number;
  openBeams: number;
  drafts: number;
}

/** each source reports the counts it knows about; a null return (or omitted fields) counts as nothing */
export type LocalActiveWorkSource = () => Partial<LocalActiveWorkSnapshot> | null;

const _sources = new Set<LocalActiveWorkSource>();

export function localActiveWorkAddSource(source: LocalActiveWorkSource): () => void {
  _sources.add(source);
  return () => void _sources.delete(source);
}

/** Summed active work counts, or null when no source has anything to report (or none registered yet) */
export function localActiveWorkGet(): LocalActiveWorkSnapshot | null {
  let sum: LocalActiveWorkSnapshot | null = null;
  for (const source of _sources) {
    const counts = source();
    if (!counts) continue;
    sum ??= { ongoingOperations: 0, openBeams: 0, drafts: 0 };
    sum.ongoingOperations += counts.ongoingOperations ?? 0;
    sum.openBeams += counts.openBeams ?? 0;
    sum.drafts += counts.drafts ?? 0;
  }
  return sum;
}
