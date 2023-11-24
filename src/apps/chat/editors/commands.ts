import { CmdRunBrowse } from '~/modules/browse/browse.client';
import { CmdRunProdia } from '~/modules/prodia/prodia.client';
import { CmdRunReact } from '~/modules/aifn/react/react';
import { CmdRunSearch } from '~/modules/google/search.client';
import { Brand } from '~/common/app.config';
import { createDMessage, DMessage } from '~/common/state/store-chats';


export const CmdAddRoleMessage: string[] = ['/assistant', '/a', '/system', '/s'];

export const CmdHelp: string[] = ['/help', '/h', '/?'];

export const commands = [...CmdRunBrowse, ...CmdRunProdia, ...CmdRunReact, ...CmdRunSearch, ...CmdAddRoleMessage, ...CmdHelp];

export interface SentencePiece {
  type: 'text' | 'cmd';
  value: string;
}

/**
 * Sentence to pieces (must have a leading slash) from the provided text
 * Used by rendering functions, as well as input processing functions.
 */
export function extractCommands(input: string): SentencePiece[] {
  // 'help' commands are the only without a space and text after
  if (CmdHelp.includes(input))
    return [{ type: 'cmd', value: input }, { type: 'text', value: '' }];
  const regexFromTags = commands.map(tag => `^\\${tag} `).join('\\b|') + '\\b';
  const pattern = new RegExp(regexFromTags, 'g');
  const result: SentencePiece[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    if (match.index !== lastIndex)
      result.push({ type: 'text', value: input.substring(lastIndex, match.index) });
    result.push({ type: 'cmd', value: match[0].trim() });
    lastIndex = pattern.lastIndex;

    // Remove the space after the matched tag
    if (input[lastIndex] === ' ')
      lastIndex++;
  }

  if (lastIndex !== input.length)
    result.push({ type: 'text', value: input.substring(lastIndex) });

  return result;
}

export function createCommandsHelpMessage(): DMessage {
  let text = 'Available Chat Commands:\n';
  text += commands.map(c => ` - ${c}`).join('\n');
  const helpMessage = createDMessage('assistant', text);
  helpMessage.originLLM = Brand.Title.Base;
  return helpMessage;
}