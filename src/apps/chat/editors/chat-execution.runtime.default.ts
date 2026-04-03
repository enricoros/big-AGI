import { ConversationsManager } from '~/common/chat-overlay/ConversationsManager';
import { useChatStore } from '~/common/stores/chat/store-chats';

import type { ChatExecutionRuntime } from './chat-execution.runtime';
import { runPersonaOnConversationHead } from './chat-persona';
import { runPersonaWithEphemeralSubagents } from './chat-execution.runtime.tools';


const defaultChatExecutionRuntime: ChatExecutionRuntime = {
  getSession: (conversationId) => {
    const handler = ConversationsManager.getHandler(conversationId);
    return {
      conversationId: handler.conversationIdRef,
      historyViewHeadOrThrow: handler.historyViewHeadOrThrow.bind(handler),
      historyFindMessageOrThrow: handler.historyFindMessageOrThrow.bind(handler),
      historyClear: handler.historyClear.bind(handler),
      messageAppend: handler.messageAppend.bind(handler),
      messageAppendAssistantText: handler.messageAppendAssistantText.bind(handler),
      messageAppendAssistantPlaceholder: handler.messageAppendAssistantPlaceholder.bind(handler),
      messageEdit: handler.messageEdit.bind(handler),
      messageFragmentAppend: handler.messageFragmentAppend.bind(handler),
      messageFragmentDelete: handler.messageFragmentDelete.bind(handler),
      messageFragmentReplace: handler.messageFragmentReplace.bind(handler),
      beamInvoke: handler.beamInvoke.bind(handler),
      createEphemeralHandler: handler.createEphemeralHandler.bind(handler),
      setAbortController: handler.setAbortController.bind(handler),
      clearAbortController: handler.clearAbortController.bind(handler),
      getCouncilSession: () => handler.conversationOverlayStore.getState().councilSession,
      setCouncilSession: (session) => handler.conversationOverlayStore.getState().setCouncilSession(session),
      updateCouncilSession: (update) => handler.conversationOverlayStore.getState().updateCouncilSession(update),
      resetCouncilSession: () => handler.conversationOverlayStore.getState().resetCouncilSession(),
      persistCouncilState: (session, councilOpLog) => useChatStore.getState().setCouncilPersistence(handler.conversationIdRef, session, councilOpLog),
    };
  },
  createAbortController: () => new AbortController(),
  runPersona: (params) => runPersonaWithEphemeralSubagents(params, innerParams => runPersonaOnConversationHead(
    innerParams.assistantLlmId,
    innerParams.conversationId,
    innerParams.systemPurposeId,
    innerParams.keepAbortController,
    innerParams.sharedAbortController,
    innerParams.participant,
    innerParams.sourceHistory,
    innerParams.createPlaceholder,
    innerParams.messageChannel,
    innerParams.runOptions,
  )),
};

export async function getDefaultChatExecutionRuntime(): Promise<ChatExecutionRuntime> {
  return defaultChatExecutionRuntime;
}
