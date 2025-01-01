import { getChatLLMId } from '~/common/stores/llms/store-llms';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import type { DMessage } from '~/common/stores/chat/chat.message';
import { ConversationHandler } from '~/common/chat-overlay/ConversationHandler';
import { ConversationsManager } from '~/common/chat-overlay/ConversationsManager';
import { createTextContentFragment, isTextContentFragment } from '~/common/stores/chat/chat.fragments';
import { getConversationSystemPurposeId } from '~/common/stores/chat/store-chats';

import type { ChatExecuteMode } from '../execute-mode/execute-mode.types';
import { textToDrawCommand } from '../commands/CommandsDraw';

import { _handleExecuteCommand, RET_NO_CMD } from './_handleExecuteCommand';
import { runImageGenerationUpdatingState } from './image-generate';
import { runPersonaOnConversationHead } from './chat-persona';
import { runReActUpdatingState } from './react-tangent';


export async function _handleExecute(chatExecuteMode: ChatExecuteMode, conversationId: DConversationId, executeCallerNameDebug: string) {

  // Handle missing conversation
  if (!conversationId)
    return 'err-no-conversation';

  const chatLLMId = getChatLLMId();
  const cHandler = ConversationsManager.getHandler(conversationId);
  const initialHistory = cHandler.historyViewHeadOrThrow('handle-execute-' + executeCallerNameDebug) as Readonly<DMessage[]>;

  // Update the system message from the active persona to the history
  // NOTE: this does NOT call setMessages anymore (optimization). make sure to:
  //       1. all the callers need to pass a new array
  //       2. all the exit points need to call setMessages
  const _inplaceEditableHistory = [...initialHistory];
  ConversationHandler.inlineUpdatePurposeInHistory(conversationId, _inplaceEditableHistory, chatLLMId || undefined);

  // Support for Prompt Caching - it's here rather than upstream to apply to user-initiated workflows
  ConversationHandler.inlineUpdateAutoPromptCaching(_inplaceEditableHistory);

  // Set the history - note that 'history' objects become invalid after this, and you'd have to
  // re-read it from the store, such as with `cHandler.historyView()`
  cHandler.historyReplace(_inplaceEditableHistory);


  // Handle unconfigured
  if (!chatLLMId || !chatExecuteMode)
    return !chatLLMId ? 'err-no-chatllm' : 'err-no-chatmode';

  // handle missing last user message (or fragment)
  // note that we use the initial history, as the user message could have been displaced on the edited versions
  const lastMessage = initialHistory.length >= 1 ? initialHistory.slice(-1)[0] : null;
  const firstFragment = lastMessage?.fragments[0];
  if (!lastMessage || !firstFragment)
    return 'err-no-last-message';


  // execute a command, if the last message has one
  if (lastMessage.role === 'user') {
    const cmdRC = await _handleExecuteCommand(lastMessage.id, firstFragment, lastMessage, cHandler, chatLLMId);
    if (cmdRC !== RET_NO_CMD) return cmdRC;
  }

  // get the system purpose (note: we don't react to it, or it would invalidate half UI components..)
  // TODO: change this massively
  if (!getConversationSystemPurposeId(conversationId)) {
    cHandler.messageAppendAssistantText('Issue: no Persona selected.', 'issue');
    return 'err-no-persona';
  }

  // synchronous long-duration tasks, which update the state as they go
  switch (chatExecuteMode) {
    case 'generate-content':
      return await runPersonaOnConversationHead(chatLLMId, conversationId);

    case 'beam-content':
      const updatedInputHistory = cHandler.historyViewHeadOrThrow('chat-beam-execute');
      cHandler.beamInvoke(updatedInputHistory, [], null);
      return true;

    case 'append-user':
      return true;

    case 'generate-image':
      // verify we were called with a single DMessageTextContent
      if (!isTextContentFragment(firstFragment))
        return false;
      const imagePrompt = firstFragment.part.text;
      cHandler.messageFragmentReplace(lastMessage.id, firstFragment.fId, createTextContentFragment(textToDrawCommand(imagePrompt)), true);
      return await runImageGenerationUpdatingState(cHandler, imagePrompt);

    case 'react-content':
      // verify we were called with a single DMessageTextContent
      if (!isTextContentFragment(firstFragment))
        return false;
      const reactPrompt = firstFragment.part.text;
      cHandler.messageFragmentReplace(lastMessage.id, firstFragment.fId, createTextContentFragment(textToDrawCommand(reactPrompt)), true);
      return await runReActUpdatingState(cHandler, reactPrompt, chatLLMId, lastMessage.id);

    default:
      console.log('Chat execute: issue running', chatExecuteMode, conversationId, lastMessage);
      return false;
  }
}
