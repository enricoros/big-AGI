import * as React from 'react';

import type { AttachmentDraft } from '~/common/attachment-drafts/attachment.types';
import type { DLLM } from '~/common/stores/llms/llms.types';
import type { DMessageAttachmentFragment } from '~/common/stores/chat/chat.fragments';
import { estimateTokensForFragments } from '~/common/stores/chat/chat.tokens';


export interface LLMAttachmentDraftsCollection {
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


export function useLLMAttachmentDrafts(attachmentDrafts: AttachmentDraft[], chatLLM: DLLM | null, chatLLMSupportsImages: boolean): LLMAttachmentDraftsCollection {

  /* [Optimization] Use a Ref to store the previous state of llmAttachmentDrafts and chatLLM
   *
   * Note that this works on 2 levels:
   * - 1. avoids recomputation, but more importantly,
   * - 2. avoids re-rendering by keeping those llmAttachmentDrafts objects stable.
   *
   * Important to notice that the attachmentDraft objects[] are stable to start with, so we can
   * safely use reference equality to check if internal properties (or order) have changed.
   */
  const prevStateRef = React.useRef<{
    chatLLM: DLLM | null;
    llmAttachmentDrafts: LLMAttachmentDraft[];
  }>({ llmAttachmentDrafts: [], chatLLM: null });

  return React.useMemo(() => {

    // [Optimization]
    const equalChatLLM = chatLLM === prevStateRef.current.chatLLM;

    // LLM-dependent multi-modal enablement
    const supportedTypes: DMessageAttachmentFragment['part']['pt'][] = chatLLMSupportsImages ? ['image_ref', 'doc'] : ['doc'];
    const supportedTextTypes: DMessageAttachmentFragment['part']['pt'][] = supportedTypes.filter(pt => pt === 'doc');

    // Add LLM-specific properties to each attachment draft
    const llmAttachmentDrafts = attachmentDrafts.map((a, index) => {

      // [Optimization] If not change in LLM and the attachmentDraft is the same object reference, reuse the previous LLMAttachmentDraft
      let prevDraft: LLMAttachmentDraft | undefined = prevStateRef.current.llmAttachmentDrafts[index];
      // if not found, search by id
      if (!prevDraft)
        prevDraft = prevStateRef.current.llmAttachmentDrafts.find(_pd => _pd.attachmentDraft.id === a.id);
      if (equalChatLLM && prevDraft && prevDraft.attachmentDraft === a)
        return prevDraft;

      // Otherwise, create a new LLMAttachmentDraft
      return {
        attachmentDraft: a,
        llmSupportsAllFragments: !a.outputFragments ? false : a.outputFragments.every(op => supportedTypes.includes(op.part.pt)),
        llmSupportsTextFragments: !a.outputFragments ? false : a.outputFragments.some(op => supportedTextTypes.includes(op.part.pt)),
        llmTokenCountApprox: chatLLM
          ? estimateTokensForFragments(chatLLM, 'user', a.outputFragments, true, 'useLLMAttachmentDrafts')
          : null,
      };
    });

    // Calculate the overall properties
    const canAttachAllFragments = llmAttachmentDrafts.every(a => a.llmSupportsAllFragments);
    const canInlineSomeFragments = llmAttachmentDrafts.some(a => a.llmSupportsTextFragments);
    const llmTokenCountApprox = chatLLM
      ? llmAttachmentDrafts.reduce((acc, a) => acc + (a.llmTokenCountApprox || 0), 0)
      : null;

    // [Optimization] Update the ref with the new state
    prevStateRef.current = { llmAttachmentDrafts, chatLLM };

    return {
      llmAttachmentDrafts,
      canAttachAllFragments,
      canInlineSomeFragments,
      llmTokenCountApprox,
    };

  }, [attachmentDrafts, chatLLM, chatLLMSupportsImages]); // Dependencies for the outer useMemo
}
