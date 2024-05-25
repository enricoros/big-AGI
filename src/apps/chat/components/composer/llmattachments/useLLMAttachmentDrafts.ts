import * as React from 'react';

import { DLLM, LLM_IF_OAI_Vision } from '~/modules/llms/store-llms';

import type { AttachmentDraft } from '~/common/attachment-drafts/attachment.types';
import type { DAttachmentPart } from '~/common/stores/chat/chat.message';
import { estimateTokensForAttachmentParts } from '~/common/stores/chat/chat.tokens';


export interface LLMAttachmentDrafts {
  llmAttachmentDrafts: LLMAttachmentDraft[];
  canAttachAllParts: boolean;
  canInlineSomeTextParts: boolean;
  llmTokenCountApprox: number | null;
}


export interface LLMAttachmentDraft {
  attachmentDraft: AttachmentDraft;
  llmSupportsAllParts: boolean;
  llmSupportsTextParts: boolean;
  llmTokenCountApprox: number | null;
}


export function useLLMAttachmentDrafts(attachmentDrafts: AttachmentDraft[], chatLLM: DLLM | null): LLMAttachmentDrafts {
  return React.useMemo(() => {

    // Adjust the recommended DAttachmentPart(s) based on the LLM
    const supportsImages = !!chatLLM?.interfaces?.includes(LLM_IF_OAI_Vision);
    const supportedOutputPartTypes: DAttachmentPart['atype'][] = supportsImages ? ['aimage', 'atext'] : ['atext'];
    const supportedTextPartTypes = supportedOutputPartTypes.filter(pt => pt === 'atext');

    // Add LLM-specific properties to each attachment draft
    const llmAttachmentDrafts = attachmentDrafts.map((a): LLMAttachmentDraft => ({
      attachmentDraft: a,
      llmSupportsAllParts: a.outputParts ? a.outputParts.every(op => supportedOutputPartTypes.includes(op.atype)) : false,
      llmSupportsTextParts: a.outputParts ? a.outputParts.some(op => supportedTextPartTypes.includes(op.atype)) : false,
      llmTokenCountApprox: chatLLM
        ? estimateTokensForAttachmentParts(a.outputParts, chatLLM, true, 'useLLMAttachmentDrafts')
        : null,
    }));

    // Calculate the overall properties
    const canAttachAllParts = llmAttachmentDrafts.every(a => a.llmSupportsAllParts);
    const canInlineSomeTextParts = llmAttachmentDrafts.some(a => a.llmSupportsTextParts);
    const llmTokenCountApprox = chatLLM
      ? llmAttachmentDrafts.reduce((acc, a) => acc + (a.llmTokenCountApprox || 0), 0)
      : null;

    return {
      llmAttachmentDrafts,
      canAttachAllParts,
      canInlineSomeTextParts,
      llmTokenCountApprox,
    };
  }, [attachmentDrafts, chatLLM]);
}
