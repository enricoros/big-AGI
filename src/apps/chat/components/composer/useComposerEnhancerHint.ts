import * as React from 'react';

import type { StoreApi } from 'zustand';

import type { AttachmentEnhancerHintItem } from '~/common/attachment-drafts/attachment.enhancers';
import type { DComposerPendingPart } from '~/common/chat-overlay/store-perchat-composer_slice';
import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import type { PerChatOverlayStore } from '~/common/chat-overlay/store-perchat_vanilla';


/**
 * Owner of the input-enhancer capability hint: a disabled enhancer would have matched
 * (e.g. video URL pasted on a non-video model). Self-contained on purpose - the Composer
 * only wires `onEnhancerDisabledMatch` into its enhancers options, renders `enhancerHintItem`,
 * and calls `clearEnhancerHint` when it clears itself.
 */
export function useComposerEnhancerHint(
  conversationOverlayStore: Readonly<StoreApi<PerChatOverlayStore>> | null,
  setComposeText: React.Dispatch<React.SetStateAction<string>>,
  targetConversationId: DConversationId | null,
): {
  enhancerHintItem: AttachmentEnhancerHintItem | null;
  onEnhancerDisabledMatch: (part: DComposerPendingPart, sourceText: string) => void;
  clearEnhancerHint: () => void;
} {

  // state - local to the composer, cleared when it retargets to another conversation
  const [hint, setHint] = React.useState<{ part: DComposerPendingPart, sourceText: string } | null>(null);
  React.useEffect(() => setHint(null), [targetConversationId]);

  // for AttachmentInputEnhancersOptions.onEnhancerDisabledMatch (may fire twice per paste - idempotent)
  const onEnhancerDisabledMatch = React.useCallback((part: DComposerPendingPart, sourceText: string) => setHint({ part, sourceText }), []);

  const clearEnhancerHint = React.useCallback(() => setHint(null), []);

  const handleConvert = React.useCallback(() => {
    // the hint chip already switched to a capable model - adopt the part and undo the fallback intake
    if (!hint) return;
    const { part, sourceText } = hint;
    setHint(null);
    const overlayState = conversationOverlayStore?.getState();
    overlayState?.addPendingPart(part);
    // pasted text out of the composer, URL attachment draft (e.g. YouTube transcript) out of the drafts
    setComposeText(text => text.includes(sourceText) ? text.replace(sourceText, '').trim() : text);
    const urlDraft = overlayState?.attachmentDrafts.find(d => d.source.media === 'url' && (d.source.refUrl.trim() === sourceText || d.source.url === sourceText));
    if (urlDraft) overlayState?.removeAttachmentDraft(urlDraft.id);
  }, [conversationOverlayStore, hint, setComposeText]);

  const enhancerHintItem = React.useMemo((): AttachmentEnhancerHintItem | null =>
    !hint ? null : { part: hint.part, onConvert: handleConvert, onDismiss: clearEnhancerHint }, [clearEnhancerHint, handleConvert, hint]);

  return { enhancerHintItem, onEnhancerDisabledMatch, clearEnhancerHint };
}
