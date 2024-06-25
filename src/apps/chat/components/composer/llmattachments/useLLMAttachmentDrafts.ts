import * as React from 'react';

import { DLLM, LLM_IF_OAI_Vision } from '~/modules/llms/store-llms';

import type { AttachmentDraft } from '~/common/attachment-drafts/attachment.types';
import type { DMessageAttachmentFragment } from '~/common/stores/chat/chat.fragments';
import { estimateTokensForFragments } from '~/common/stores/chat/chat.tokens';


export interface LLMAttachmentDrafts {
  llmAttachmentDrafts: LLMAttachmentDraft[];
  canAttachAllFragments: boolean;
  canInlineSomeFragments: boolean;
  llmTokenCountApprox: number | null;
}


export interface LLMAttachmentDraft {
  attachmentDraft: AttachmentDraft;
  llmSupportsAllFragments: boolean;
  llmSupportsTextFragments: boolean;
  llmTokenCountApprox: number | null;
}


export function useLLMAttachmentDrafts(attachmentDrafts: AttachmentDraft[], chatLLM: DLLM | null): LLMAttachmentDrafts {
  return React.useMemo(() => {

    // LLM-dependent multi-modal enablement
    const supportsImages = !!chatLLM?.interfaces?.includes(LLM_IF_OAI_Vision);
    const supportedTypes: DMessageAttachmentFragment['part']['pt'][] = supportsImages ? ['image_ref', 'doc'] : ['doc'];
    const supportedTextTypes: DMessageAttachmentFragment['part']['pt'][] = supportedTypes.filter(pt => pt === 'doc');

    // Add LLM-specific properties to each attachment draft
    const llmAttachmentDrafts = attachmentDrafts.map((a): LLMAttachmentDraft => ({
      attachmentDraft: a,
      llmSupportsAllFragments: !a.outputFragments ? false : a.outputFragments.every(op => supportedTypes.includes(op.part.pt)),
      llmSupportsTextFragments: !a.outputFragments ? false : a.outputFragments.some(op => supportedTextTypes.includes(op.part.pt)),
      llmTokenCountApprox: chatLLM
        ? estimateTokensForFragments(a.outputFragments, chatLLM, true, 'useLLMAttachmentDrafts')
        : null,
    }));

    // Calculate the overall properties
    const canAttachAllFragments = llmAttachmentDrafts.every(a => a.llmSupportsAllFragments);
    const canInlineSomeFragments = llmAttachmentDrafts.some(a => a.llmSupportsTextFragments);
    const llmTokenCountApprox = chatLLM
      ? llmAttachmentDrafts.reduce((acc, a) => acc + (a.llmTokenCountApprox || 0), 0)
      : null;

    return {
      llmAttachmentDrafts,
      canAttachAllFragments,
      canInlineSomeFragments,
      llmTokenCountApprox,
    };
  }, [attachmentDrafts, chatLLM]);
}
