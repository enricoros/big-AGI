import type { ConversationHandler } from '~/common/chat-overlay/ConversationHandler';
import type { DLLMId } from '~/common/stores/llms/llms.types';
import type { DMessage } from '~/common/stores/chat/chat.message';
import type { DMessageFragmentId } from '~/common/stores/chat/chat.fragments';
import { createErrorContentFragment, createTextContentFragment, isTextContentFragment } from '~/common/stores/chat/chat.fragments';

import { buildConversationContext, extractLastUserMessageText, runSLMPipeline } from '~/modules/slm/slm.pipeline';


export async function runSLMUpdatingState(cHandler: ConversationHandler, history: Readonly<DMessage[]>, assistantLlmId: DLLMId) {
  const userMessage = extractLastUserMessageText(history);
  if (!userMessage) {
    cHandler.messageAppendAssistantText('Issue: no message provided.', 'issue');
    return false;
  }

  const { assistantMessageId, placeholderFragmentId } = cHandler.messageAppendAssistantPlaceholder(
    '⚡ Liquid Matrix initializing...',
    { generator: { mgt: 'named', name: 'slm-' + assistantLlmId } },
  );

  const abortController = new AbortController();
  cHandler.setAbortController(abortController, 'slm-tangent');

  // The placeholder is a void fragment - track the real text fragment fId after first replace
  let textFragmentId: DMessageFragmentId = placeholderFragmentId;
  let hasTextFragment = false;

  const setFragmentText = (text: string, complete: boolean) => {
    if (!hasTextFragment) {
      // Swap void placeholder for a real text content fragment, track the new fId
      const newFrag = createTextContentFragment(text);
      cHandler.messageFragmentReplace(assistantMessageId, textFragmentId, newFrag, complete);
      textFragmentId = newFrag.fId;
      hasTextFragment = true;
    } else {
      // Update the existing text fragment in-place (same fId - no remount)
      cHandler.messageEdit(assistantMessageId, (message) => {
        const idx = message.fragments.findIndex(f => f.fId === textFragmentId);
        if (idx < 0) return {};
        const frag = message.fragments[idx];
        if (!isTextContentFragment(frag)) return {};
        return {
          fragments: message.fragments.map((f, i) =>
            i === idx ? { ...frag, part: { ...frag.part, text } } : f,
          ),
        };
      }, complete, false);
    }
  };

  try {
    await runSLMPipeline({
      userMessage,
      conversationContext: buildConversationContext(history),
      llmId: assistantLlmId,
      abortSignal: abortController.signal,
      onProgress: setFragmentText,
    });

    return true;
  } catch (error: any) {
    const msg = `**SLM Pipeline Error**\n\n${error?.message ?? 'Unknown error'}`;
    cHandler.messageFragmentReplace(assistantMessageId, textFragmentId, createErrorContentFragment(msg), true);
    return false;
  } finally {
    cHandler.clearAbortController('slm-tangent');
  }
}
