import type { AttachmentDraft } from '../attachment.types';


/**
 * Per-draft enrichment interface - provides LLM-specific (or context-specific)
 * compatibility/token info for an AttachmentDraft.
 *
 * Implementations may be LLM-aware (Composer) or simple pass-throughs (edit mode).
 */
export interface IAttachmentEnrichment {
  /** Whether all output fragments of this draft are supported */
  isCompatible(draft: AttachmentDraft): boolean;

  /** Whether this draft has text fragments that can be inlined */
  supportsTextInline(draft: AttachmentDraft): boolean;

  /** Approximate token count for this draft, or null if unknown */
  estimateTokens(draft: AttachmentDraft): number | null;

  /** Approximate total token count across all drafts, or null if unknown */
  estimateTotalTokens(drafts: AttachmentDraft[]): number | null;

  /** Whether this draft contains image fragments */
  hasImages(draft: AttachmentDraft): boolean;
}

/**
 * Pre-computed collection-level summary derived from IAttachmentEnrichment
 * across all drafts. Used to avoid re-computing in multiple places.
 */
export interface AttachmentEnrichmentSummary {
  allCompatible: boolean;
  anyImages: boolean;
  anyInlinable: boolean;
  totalTokensApprox: number | null;
}
