import { getChatLLMId } from '~/modules/llms/store-llms';
import { updateHistoryForReplyTo } from '~/modules/aifn/replyto/replyTo';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import type { DMessage } from '~/common/stores/chat/chat.message';
import { ConversationsManager } from '~/common/chats/ConversationsManager';
import { createTextContentFragment, isContentFragment, isTextPart } from '~/common/stores/chat/chat.fragments';
import { getConversationSystemPurposeId } from '~/common/stores/chat/store-chats';
import { getUXLabsHighPerformance } from '~/common/state/store-ux-labs';

import type { ChatModeId } from '../AppChat';
import { getInstantAppChatPanesCount } from '../components/panes/usePanesManager';
import { textToDrawCommand } from '../commands/CommandsDraw';

import { _handleExecuteCommand, RET_NO_CMD } from './_handleExecuteCommand';
import { runAssistantUpdatingState } from './chat-stream';
import { runImageGenerationUpdatingState } from './image-generate';
import { runReActUpdatingState } from './react-tangent';


export async function _handleExecute(chatModeId: ChatModeId, conversationId: DConversationId, history: Readonly<DMessage[]>) {

  // Handle missing conversation
  if (!conversationId)
    return 'err-no-conversation';

  const chatLLMId = getChatLLMId();
  const cHandler = ConversationsManager.getHandler(conversationId);

  // Update the system message from the active persona to the history
  // NOTE: this does NOT call setMessages anymore (optimization). make sure to:
  //       1. all the callers need to pass a new array
  //       2. all the exit points need to call setMessages
  const _inplaceEditableHistory = [...history];
  cHandler.inlineUpdatePurposeInHistory(_inplaceEditableHistory, chatLLMId || undefined);

  // FIXME: shouldn't do this for all the code paths. The advantage for having it here (vs Composer output only) is re-executing history
  // TODO: move this to the server side after transferring metadata?
  updateHistoryForReplyTo(_inplaceEditableHistory);

  // Set the history - note that 'history' objects become invalid after this, and you'd have to
  // re-read it from the store, such as with `cHandler.viewHistory()`
  cHandler.replaceMessages(_inplaceEditableHistory);


  // Handle unconfigured
  if (!chatLLMId || !chatModeId)
    return !chatLLMId ? 'err-no-chatllm' : 'err-no-chatmode';

  // handle missing last user message (or fragment)
  // note that we use the initial history, as the user message could have been displaced on the edited versions
  const lastMessage = history.length >= 1 ? history.slice(-1)[0] : null;
  const firstFragment = lastMessage?.fragments[0];
  if (!lastMessage || !firstFragment)
    return 'err-no-last-message';


  // execute a command, if the last message has one
  if (lastMessage.role === 'user') {
    const cmdRC = await _handleExecuteCommand(lastMessage.id, firstFragment, cHandler, chatLLMId);
    if (cmdRC !== RET_NO_CMD) return cmdRC;
  }

  // get the system purpose (note: we don't react to it, or it would invalidate half UI components..)
  // TODO: change this massively
  if (!getConversationSystemPurposeId(conversationId)) {
    cHandler.messageAppendAssistantText('Issue: no Persona selected.', 'issue');
    return 'err-no-persona';
  }

  // synchronous long-duration tasks, which update the state as they go
  switch (chatModeId) {
    case 'generate-text':
      return await runAssistantUpdatingState(conversationId, cHandler.viewHistory('generate-text'), chatLLMId, getUXLabsHighPerformance() ? 0 : getInstantAppChatPanesCount());

    case 'generate-text-beam':
      cHandler.beamInvoke(cHandler.viewHistory('generate-text-beam'), [], null);
      return true;

    case 'append-user':
      return true;

    case 'generate-image':
      // verify we were called with a single DMessageTextContent
      if (!isContentFragment(firstFragment) || !isTextPart(firstFragment.part))
        return false;
      const imagePrompt = firstFragment.part.text;
      cHandler.messageFragmentReplace(lastMessage.id, firstFragment.fId, createTextContentFragment(textToDrawCommand(imagePrompt)), true);
      return await runImageGenerationUpdatingState(cHandler, imagePrompt);

    case 'generate-react':
      // verify we were called with a single DMessageTextContent
      if (!isContentFragment(firstFragment) || !isTextPart(firstFragment.part))
        return false;
      const reactPrompt = firstFragment.part.text;
      cHandler.messageFragmentReplace(lastMessage.id, firstFragment.fId, createTextContentFragment(textToDrawCommand(reactPrompt)), true);
      return await runReActUpdatingState(cHandler, reactPrompt, chatLLMId);

    default:
      console.log('Chat execute: issue running', chatModeId, conversationId, lastMessage);
      return false;
  }
}
