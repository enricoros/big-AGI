import type { DLLMId } from '~/common/stores/llms/llms.types';
import type { DMessage, DMessageId } from '~/common/stores/chat/chat.message';
import { ConversationHandler } from '~/common/chat-overlay/ConversationHandler';
import { createTextContentFragment, DMessageFragment, isTextContentFragment } from '~/common/stores/chat/chat.fragments';

import { extractChatCommand, helpPrettyChatCommands } from '../commands/commands.registry';
import { runBrowseGetPageUpdatingState } from './browse-load';
import { runImageGenerationUpdatingState } from './image-generate';
import { runReActUpdatingState } from './react-tangent';


export const RET_NO_CMD = 'no-cmd';


export async function _handleExecuteCommand(lastMessageId: DMessageId, lastMessageFirstFragment: DMessageFragment, lastMessage: Readonly<DMessage>, cHandler: ConversationHandler, chatLLMId: DLLMId) {

  // commands must have a first Content DMessageTextPart
  if (!isTextContentFragment(lastMessageFirstFragment))
    return RET_NO_CMD;

  // check if we have a command
  const _chatCommand = extractChatCommand(lastMessageFirstFragment.part.text)[0];
  if (_chatCommand?.type !== 'cmd')
    return RET_NO_CMD;

  // extract the information from the command
  const { providerId, command: userCommand, params: userText, isErrorNoArgs } = _chatCommand;

  // create a copy of the lastMessage without the 'command' part in the first fragment
  // TODO: future: move command to be decorators (meta parts) on the message
  const lastMessageNoCommand = { ...lastMessage };


  // Valid /commands are intercepted here, and override chat modes, generally for mechanics or sidebars
  switch (providerId) {

    case 'cmd-ass-browse':
      return await runBrowseGetPageUpdatingState(cHandler, userText);

    case 'cmd-ass-t2i':
      return await runImageGenerationUpdatingState(cHandler, userText);

    case 'cmd-chat-alter':
      // clear command
      if (userCommand === '/clear') {
        if (userText === 'all')
          cHandler.historyClear();
        else
          cHandler.messageAppendAssistantText('Issue: this command requires the \'all\' parameter to confirm the operation.', 'issue');
        return true;
      }
      // assistant/system command: change role and remove the /command
      cHandler.messageEdit(lastMessageId, { role: userCommand.startsWith('/s') ? 'system' : userCommand.startsWith('/a') ? 'assistant' : 'user' }, false, false);
      cHandler.messageFragmentReplace(lastMessageId, lastMessageFirstFragment.fId, createTextContentFragment(userText || ''), true);
      return true;

    case 'cmd-help':
      cHandler.messageAppendAssistantText(`Available Chat Commands:\n${helpPrettyChatCommands()}`, 'help');
      return true;

    // NOTE 12/9/2024: removed this as /beam should not be a command, but it's already a chat mode, e.g. can't be headless executed.
    //                 the following code is here for reference/historical reasons
    // case 'cmd-mode-beam':
    //   if (isErrorNoArgs || !userText)
    //     return false;
    //   // remove '/beam ', as we want to be a user chat message
    //   cHandler.messageFragmentReplace(lastMessageId, lastMessageFirstFragment.fId, createTextContentFragment(userText), true);
    //   cHandler.beamInvoke(cHandler.historyViewHead('cmd-mode-beam'), [], null);
    //   return true;

    case 'cmd-mode-react':
      // create a temporary copy of the message,

      return await runReActUpdatingState(cHandler, userText, chatLLMId, lastMessageId);

    default:
      cHandler.messageAppendAssistantText('This command is not supported', 'help');
      return false;
  }
}
