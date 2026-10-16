import * as React from 'react';

import type { DLLM } from '~/common/stores/llms/llms.types';
import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';

import type { AttachmentDraft } from '../attachment.types';
import { useAttachmentDraftsEnrichment } from './useAttachmentDraftsEnrichment';


/**
 * The image-input policy for a chat input surface, in one place: does the model accept images,
 * are the current drafts compatible with it, and the pre-send confirmation when they are not.
 */
export function useLLMImageInputPolicy(chatLLM: DLLM | null, attachmentDrafts: AttachmentDraft[]) {

  // external state
  const { showPromisedOverlay } = useOverlayComponents();

  // the single vision seam: LLM_IF_OAI_Vision = image inputs
  const chatLLMSupportsImages = !!chatLLM?.interfaces?.includes(LLM_IF_OAI_Vision);

  // drafts (in)compatibility with the current model + token estimation
  const { enrichment: attEnrichment, summary: attEnrichSummary } = useAttachmentDraftsEnrichment(attachmentDrafts, chatLLM, chatLLMSupportsImages);

  // pre-send gate: warn (and allow reviewing) when some attachments don't fit the model
  const confirmUnsupportedLLMAttachments = React.useCallback(async (): Promise<boolean> => {
    if (attEnrichSummary.allCompatible) return true;
    return await showPromisedOverlay('composer-unsupported-attachments', { rejectWithValue: false }, ({ onResolve, onUserReject }) => (
      <ConfirmationModal
        open
        onClose={onUserReject}
        onPositive={() => onResolve(true)}
        confirmationText='Some attached files may not be fully compatible with the current AI model. This could affect processing. Would you like to review or proceed?'
        positiveActionText='Proceed'
        negativeActionText='Review Attachments'
        title='Attachment Compatibility Notice'
      />
    ));
  }, [attEnrichSummary.allCompatible, showPromisedOverlay]);

  return {
    chatLLMSupportsImages,
    attEnrichment,
    attEnrichSummary,
    confirmUnsupportedLLMAttachments,
  };
}
