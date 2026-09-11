import type { DLLM, DLLMId } from '~/common/stores/llms/llms.types';
import { useLLM } from '~/common/stores/llms/llms.hooks';
import { useModelDomain } from '~/common/stores/llms/hooks/useModelDomain';

import type { DConversationId } from '../chat.conversation';
import { useChatStore } from '../store-chats';


/**
 * Per-conversation model binding: the pinned model (conversation.userLlmId) when set and still
 * existing, otherwise the 'primaryChat' domain default. Mirrors getConversationChatLLMId, but
 * reactive for the UI (model selector pin state, pane badges).
 */
export function useConversationModelBinding(conversationId: DConversationId | null): {
  isPinned: boolean;
  boundLlmId: DLLMId | null;
  boundLlm: DLLM | undefined;
} {

  // external state
  const userLlmId = useChatStore(state => !conversationId ? undefined : state.conversations.find(_c => _c.id === conversationId)?.userLlmId);
  const { domainModelId } = useModelDomain('primaryChat');
  const pinnedLlm = useLLM(userLlmId); // undefined when the pin is broken (model removed / different install) - degrade to the default

  // derived state
  const isPinned = !!userLlmId && !!pinnedLlm;
  const boundLlmId: DLLMId | null = isPinned ? userLlmId : (domainModelId ?? null);
  const boundLlm = useLLM(boundLlmId);

  return { isPinned, boundLlmId, boundLlm };
}
