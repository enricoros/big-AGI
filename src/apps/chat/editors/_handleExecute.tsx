import { getChatLLMId } from '~/modules/llms/store-llms';

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


export async function _handleExecute(chatModeId: ChatModeId, conversationId: DConversationId, history: DMessage[]): Promise<void> {
  const chatLLMId = getChatLLMId();
  if (!chatModeId || !conversationId || !chatLLMId) return;

  // Update the system message from the active persona to the history
  // NOTE: this does NOT call setMessages anymore (optimization). make sure to:
  //       1. all the callers need to pass a new array
  //       2. all the exit points need to call setMessages
  const cHandler = ConversationsManager.getHandler(conversationId);
  cHandler.inlineUpdatePurposeInHistory(history, chatLLMId);

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
            if (chatCommand.params === 'all')
              return cHandler.messagesReplace([]);
            cHandler.messagesReplace(history);
            cHandler.messageAppendAssistant('Issue: this command requires the \'all\' parameter to confirm the operation.', undefined, 'issue', false);
            return;
          }
          // /assistant, /system
          Object.assign(lastMessage, {
            role: chatCommand.command.startsWith('/s') ? 'system' : chatCommand.command.startsWith('/a') ? 'assistant' : 'user',
            sender: 'Bot',
            text: chatCommand.params || '',
          } satisfies Partial<DMessage>);
          return cHandler.messagesReplace(history);

        case 'cmd-help':
          const chatCommandsText = findAllChatCommands()
            .map(cmd => ` - ${cmd.primary}` + (cmd.alternatives?.length ? ` (${cmd.alternatives.join(', ')})` : '') + `: ${cmd.description}`)
            .join('\n');
          cHandler.messagesReplace(history);
          cHandler.messageAppendAssistant('Available Chat Commands:\n' + chatCommandsText, undefined, 'help', false);
          return;

        case 'mode-beam':
          if (chatCommand.isError)
            return cHandler.messagesReplace(history);
          // remove '/beam ', as we want to be a user chat message
          Object.assign(lastMessage, { text: chatCommand.params || '' });
          cHandler.messagesReplace(history);
          return ConversationsManager.getHandler(conversationId).beamInvoke(history, [], null);

        default:
          return cHandler.messagesReplace([...history, createDMessage('assistant', 'This command is not supported.')]);
      }
    }
  }


  // get the system purpose (note: we don't react to it, or it would invalidate half UI components..)
  if (!getConversationSystemPurposeId(conversationId)) {
    cHandler.messagesReplace(history);
    cHandler.messageAppendAssistant('Issue: no Persona selected.', undefined, 'issue', false);
    return;
  }

  // synchronous long-duration tasks, which update the state as they go
  switch (chatModeId) {
    case 'generate-text':
      cHandler.messagesReplace(history);
      return await runAssistantUpdatingState(conversationId, history, chatLLMId, getUXLabsHighPerformance() ? 0 : getInstantAppChatPanesCount());

    case 'generate-text-beam':
      cHandler.messagesReplace(history);
      return cHandler.beamInvoke(history, [], null);

    case 'append-user':
      return cHandler.messagesReplace(history);

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
}