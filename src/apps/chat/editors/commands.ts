import { CmdRunBrowse } from '~/modules/browse/browse.client';
import { CmdRunReact } from '~/modules/aifn/react/react';
import { CmdRunSearch } from '~/modules/google/search.client';
import { CmdRunT2I } from '~/modules/t2i/t2i.client';
import { Brand } from '~/common/app.config';
import { createDMessage, DMessage } from '~/common/state/store-chats';


export const CmdAddRoleMessage: string[] = ['/assistant', '/a', '/system', '/s'];

export const CmdHelp: string[] = ['/help', '/h', '/?'];

const AllNonHelpCommands = [...CmdRunBrowse, ...CmdRunT2I, ...CmdRunReact, ...CmdRunSearch, ...CmdAddRoleMessage];
const HelpCommands = [...CmdHelp];


function buildCommandRegexPattern(commands: string[]): RegExp {
  // Escape regex special characters in commands
  const escapedCommands = commands.map(cmd => cmd.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'));
  // Join the escaped commands into a single regex pattern
  const pattern = `(${escapedCommands.join('|')})(?=\\s|$)`;
  return new RegExp(pattern, 'i');
}

const allCommandsRegex = buildCommandRegexPattern(AllNonHelpCommands);


export interface SentencePiece {
  type: 'text' | 'cmd';
  value: string;
}

/**
 * Sentence to pieces (must have a leading slash) from the provided text
 * Used by rendering functions, as well as input processing functions.
 */
export function extractCommands(input: string): SentencePiece[] {

  // Check for help commands first
  const inputTrimmed = input.trim();
  if (HelpCommands.includes(inputTrimmed))
    return [{ type: 'cmd', value: inputTrimmed }, { type: 'text', value: '' }];

  // Find the first command match in the input
  const match = allCommandsRegex.exec(input);
  if (match) {
    const beforeCommand = input.substring(0, match.index).trim();
    const afterCommand = input.substring(match.index + match[0].length).trim();

    if (!beforeCommand && afterCommand) {
      return [
        { type: 'cmd', value: match[0].trim() },
        { type: 'text', value: afterCommand },
      ];
    }
  }

  // If no command is found, return the entire input as text
  return [{ type: 'text', value: input }];
}

export function createCommandsHelpMessage(): DMessage {
  let text = 'Available Chat Commands:\n';
  text += AllNonHelpCommands.map(c => ` - ${c}`).join('\n');
  const helpMessage = createDMessage('assistant', text);
  helpMessage.originLLM = Brand.Title.Base;
  return helpMessage;
}