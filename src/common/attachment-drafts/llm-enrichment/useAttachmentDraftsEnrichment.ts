import * as React from 'react';

import type { DLLM } from '~/common/stores/llms/llms.types';
import type { DMessageAttachmentFragment } from '~/common/stores/chat/chat.fragments';
import { estimateTokensForFragments } from '~/common/stores/chat/chat.tokens';
import { useShallowStable } from '~/common/util/hooks/useShallowObject';

import type { AttachmentDraft } from '../attachment.types';
import type { AttachmentEnrichmentSummary, IAttachmentEnrichment } from './attachment.enrichment';


// configuration
// TODO: consider also Audio inputs, maybe PDF binary inputs
// FIXME: reference fragments could refer to non-image as well(!)
const _IMAGE_TYPES: DMessageAttachmentFragment['part']['pt'][] = [
  'reference', // _DMessageReferencePartBase
  'image_ref', // DMessageImageRefPart (legacy)
] as const;


/**
 * LLM-specific implementation of IAttachmentEnrichment.
 * Determines compatibility based on a target LLM's capabilities.
 */
class LLMAttachmentEnrichment implements IAttachmentEnrichment {

  private readonly supportedTextTypes: DMessageAttachmentFragment['part']['pt'][];
  private readonly supportedTypes: DMessageAttachmentFragment['part']['pt'][];

  constructor(private readonly llm: DLLM | null, supportsImages: boolean) {
    this.supportedTypes = supportsImages ? [..._IMAGE_TYPES, 'doc'] : ['doc'];
    this.supportedTextTypes = this.supportedTypes.filter(pt => pt === 'doc');
  }

  isCompatible = (draft: AttachmentDraft): boolean => {
    if (!draft.outputFragments) return false;
    return draft.outputFragments.every(op => this.supportedTypes.includes(op.part.pt));
  };

  supportsTextInline = (draft: AttachmentDraft): boolean => {
    if (!draft.outputFragments) return false;
    return draft.outputFragments.some(op => this.supportedTextTypes.includes(op.part.pt));
  };

  estimateTokens = (draft: AttachmentDraft): number | null => {
    if (!this.llm) return null;
    return estimateTokensForFragments(this.llm, 'user', draft.outputFragments, true, 'useAttachmentDraftsEnrichment');
  };

  estimateTotalTokens = (drafts: AttachmentDraft[]): number | null => {
    if (!this.llm) return null;
    return drafts.reduce((acc, d) => acc + (this.estimateTokens(d) || 0), 0);
  };

  hasImages = (draft: AttachmentDraft): boolean => {
    if (!draft.outputFragments) return false;
    return draft.outputFragments.some(op => _IMAGE_TYPES.includes(op.part.pt));
  };

}


/**
 * Hook that creates an LLM-specific IAttachmentEnrichment and computes
 * collection-level summary for the given attachment drafts.
 */
export function useAttachmentDraftsEnrichment(attachmentDrafts: AttachmentDraft[], chatLLM: DLLM | null, chatLLMSupportsImages: boolean): {
  enrichment: IAttachmentEnrichment;
  summary: AttachmentEnrichmentSummary;
} {

  // Enrichment instance - stable, only recreated if inputs change
  const enrichment = React.useMemo(
    () => new LLMAttachmentEnrichment(chatLLM, chatLLMSupportsImages),
    [chatLLM, chatLLMSupportsImages],
  );

  // Collection-level summary - shallow-stabilized to avoid unnecessary re-renders
  const summary = useShallowStable<AttachmentEnrichmentSummary>({
    allCompatible: attachmentDrafts.every(enrichment.isCompatible),
    anyImages: attachmentDrafts.some(enrichment.hasImages),
    anyInlinable: attachmentDrafts.some(enrichment.supportsTextInline),
    totalTokensApprox: enrichment.estimateTotalTokens(attachmentDrafts),
  });

  return { enrichment, summary };
}
