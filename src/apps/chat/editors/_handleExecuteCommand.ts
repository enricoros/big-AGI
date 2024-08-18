import type { DLLMId } from '~/common/stores/llms/llms.types';
import type { DMessageId } from '~/common/stores/chat/chat.message';
import { ConversationHandler } from '~/common/chat-overlay/ConversationHandler';
import { createTextContentFragment, DMessageFragment, isContentFragment, isTextPart } from '~/common/stores/chat/chat.fragments';

import { extractChatCommand, helpPrettyChatCommands } from '../commands/commands.registry';
import { runBrowseGetPageUpdatingState } from './browse-load';
import { runImageGenerationUpdatingState } from './image-generate';
import { runReActUpdatingState } from './react-tangent';


export const RET_NO_CMD = 'no-cmd';


export async function _handleExecuteCommand(lastMessageId: DMessageId, lastMessageFirstFragment: DMessageFragment, cHandler: ConversationHandler, chatLLMId: DLLMId) {

  // commands must have a first Content DMessageTextPart
  if (!isContentFragment(lastMessageFirstFragment) || !isTextPart(lastMessageFirstFragment.part))
    return RET_NO_CMD;

  // check if we have a command
  const chatCommand = extractChatCommand(lastMessageFirstFragment.part.text)[0];
  if (chatCommand?.type !== 'cmd')
    return RET_NO_CMD;

  // Valid /commands are intercepted here, and override chat modes, generally for mechanics or sidebars
  switch (chatCommand.providerId) {

    case 'cmd-ass-browse':
      return await runBrowseGetPageUpdatingState(cHandler, chatCommand.params);

    case 'cmd-ass-t2i':
      return await runImageGenerationUpdatingState(cHandler, chatCommand.params);

    case 'cmd-chat-alter':
      // clear command
      if (chatCommand.command === '/clear') {
        if (chatCommand.params === 'all')
          cHandler.historyClear();
        else
          cHandler.messageAppendAssistantText('Issue: this command requires the \'all\' parameter to confirm the operation.', 'issue');
        return true;
      }
      // assistant/system command: change role and remove the /command
      cHandler.messageEdit(lastMessageId, { role: chatCommand.command.startsWith('/s') ? 'system' : chatCommand.command.startsWith('/a') ? 'assistant' : 'user' }, false, false);
      cHandler.messageFragmentReplace(lastMessageId, lastMessageFirstFragment.fId, createTextContentFragment(chatCommand.params || ''), true);
      return true;

    case 'cmd-help':
      cHandler.messageAppendAssistantText(`Available Chat Commands:\n${helpPrettyChatCommands()}`, 'help');
      return true;

    case 'cmd-mode-beam':
      if (chatCommand.isErrorNoArgs || !chatCommand.params)
        return false;
      // remove '/beam ', as we want to be a user chat message
      cHandler.messageFragmentReplace(lastMessageId, lastMessageFirstFragment.fId, createTextContentFragment(chatCommand.params), true);
      cHandler.beamInvoke(cHandler.historyViewHead('cmd-mode-beam'), [], null);
      return true;

    case 'cmd-mode-react':
      return await runReActUpdatingState(cHandler, chatCommand.params, chatLLMId);

    default:
      cHandler.messageAppendAssistantText('This command is not supported', 'help');
      return false;
  }
}
