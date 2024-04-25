import { getChatLLMId } from '~/modules/llms/store-llms';
import { updateHistoryForReplyTo } from '~/modules/aifn/replyto/replyTo';

import { ConversationsManager } from '~/common/chats/ConversationsManager';
import { createDMessage, DConversationId, DMessage, getConversationSystemPurposeId } from '~/common/state/store-chats';
import { getUXLabsHighPerformance } from '~/common/state/store-ux-labs';

import { extractChatCommand, findAllChatCommands } from '../commands/commands.registry';
import { getInstantAppChatPanesCount } from '../components/panes/usePanesManager';

import { runAssistantUpdatingState } from './chat-stream';
import { runBrowseGetPageUpdatingState } from './browse-load';
import { runImageGenerationUpdatingState } from './image-generate';
import { runReActUpdatingState } from './react-tangent';

import type { ChatModeId } from '../AppChat';


export async function _handleExecute(chatModeId: ChatModeId, conversationId: DConversationId, history: DMessage[]) {

  // Handle missing conversation
  if (!conversationId)
    return 'err-no-conversation';

  const chatLLMId = getChatLLMId();

  // Update the system message from the active persona to the history
  // NOTE: this does NOT call setMessages anymore (optimization). make sure to:
  //       1. all the callers need to pass a new array
  //       2. all the exit points need to call setMessages
  const cHandler = ConversationsManager.getHandler(conversationId);
  cHandler.inlineUpdatePurposeInHistory(history, chatLLMId || undefined);

  // FIXME: shouldn't do this for all the code paths. The advantage for having it here (vs Composer output only) is re-executing history
  // TODO: move this to the server side after transferring metadata?
  updateHistoryForReplyTo(history);

  // Handle unconfigured
  if (!chatLLMId || !chatModeId) {
    // set the history (e.g. the updated system prompt and the user prompt) at least, see #523
    cHandler.messagesReplace(history);
    return !chatLLMId ? 'err-no-chatllm' : 'err-no-chatmode';
  }

  // Valid /commands are intercepted here, and override chat modes, generally for mechanics or sidebars
  const lastMessage = history.length > 0 ? history[history.length - 1] : null;
  if (lastMessage?.role === 'user') {
    const chatCommand = extractChatCommand(lastMessage.text)[0];
    if (chatCommand && chatCommand.type === 'cmd') {
      switch (chatCommand.providerId) {
        case 'ass-browse':
          cHandler.messagesReplace(history); // show command
          return await runBrowseGetPageUpdatingState(cHandler, chatCommand.params);

        case 'ass-t2i':
          cHandler.messagesReplace(history); // show command
          return await runImageGenerationUpdatingState(cHandler, chatCommand.params);

        case 'ass-react':
          cHandler.messagesReplace(history); // show command
          return await runReActUpdatingState(cHandler, chatCommand.params, chatLLMId);

        case 'chat-alter':
          // /clear
          if (chatCommand.command === '/clear') {
            if (chatCommand.params === 'all') {
              cHandler.messagesReplace([]);
            } else {
              cHandler.messagesReplace(history);
              cHandler.messageAppendAssistant('Issue: this command requires the \'all\' parameter to confirm the operation.', undefined, 'issue', false);
            }
            return true;
          }
          // /assistant, /system
          Object.assign(lastMessage, {
            role: chatCommand.command.startsWith('/s') ? 'system' : chatCommand.command.startsWith('/a') ? 'assistant' : 'user',
            sender: 'Bot',
            text: chatCommand.params || '',
          } satisfies Partial<DMessage>);
          cHandler.messagesReplace(history);
          return true;

        case 'cmd-help':
          const chatCommandsText = findAllChatCommands()
            .map(cmd => ` - ${cmd.primary}` + (cmd.alternatives?.length ? ` (${cmd.alternatives.join(', ')})` : '') + `: ${cmd.description}`)
            .join('\n');
          cHandler.messagesReplace(history);
          cHandler.messageAppendAssistant('Available Chat Commands:\n' + chatCommandsText, undefined, 'help', false);
          return true;

        case 'mode-beam':
          if (chatCommand.isError) {
            cHandler.messagesReplace(history);
            return false;
          }
          // remove '/beam ', as we want to be a user chat message
          Object.assign(lastMessage, { text: chatCommand.params || '' });
          cHandler.messagesReplace(history);
          ConversationsManager.getHandler(conversationId).beamInvoke(history, [], null);
          return true;

        default:
          cHandler.messagesReplace([...history, createDMessage('assistant', 'This command is not supported.')]);
          return false;
      }
    }
  }


  // get the system purpose (note: we don't react to it, or it would invalidate half UI components..)
  if (!getConversationSystemPurposeId(conversationId)) {
    cHandler.messagesReplace(history);
    cHandler.messageAppendAssistant('Issue: no Persona selected.', undefined, 'issue', false);
    return 'err-no-persona';
  }

  // synchronous long-duration tasks, which update the state as they go
  switch (chatModeId) {
    case 'generate-text':
      cHandler.messagesReplace(history);
      return await runAssistantUpdatingState(conversationId, history, chatLLMId, getUXLabsHighPerformance() ? 0 : getInstantAppChatPanesCount());

    case 'generate-text-beam':
      cHandler.messagesReplace(history);
      cHandler.beamInvoke(history, [], null);
      return true;

    case 'append-user':
      cHandler.messagesReplace(history);
      return true;

    case 'generate-image':
      if (!lastMessage?.text) break;
      // also add a 'fake' user message with the '/draw' command
      cHandler.messagesReplace(history.map(message => (message.id !== lastMessage.id) ? message : {
        ...message,
        text: `/draw ${lastMessage.text}`,
      }));
      return await runImageGenerationUpdatingState(cHandler, lastMessage.text);

    case 'generate-react':
      if (!lastMessage?.text) break;
      cHandler.messagesReplace(history);
      return await runReActUpdatingState(cHandler, lastMessage.text, chatLLMId);
  }

  // ISSUE: if we're here, it means we couldn't do the job, at least sync the history
  console.log('Chat execute: issue running', chatModeId, conversationId, lastMessage);
  cHandler.messagesReplace(history);
  return false;
}