import type { ChatCommand, ICommandsProvider } from './ICommandsProvider';

import { CommandsAlter } from './CommandsAlter';
import { CommandsDraw } from './CommandsDraw';
import { CommandsHelp } from './CommandsHelp';
import { CommandsReact } from './CommandsReact';


export type CommandsProviderId = 'cmd-ass-t2i' | 'cmd-chat-alter' | 'cmd-help' | 'cmd-mode-react';

type TextCommandPiece =
  | { type: 'nocmd'; value: string; }
  | { type: 'cmd'; providerId: CommandsProviderId, command: string; params?: string, isErrorNoArgs?: boolean };


const ChatCommandsProviders: Record<CommandsProviderId, ICommandsProvider> = {
  'cmd-ass-t2i': CommandsDraw,
  'cmd-chat-alter': CommandsAlter,
  'cmd-help': CommandsHelp,
  'cmd-mode-react': CommandsReact,
};

export function findAllChatCommands(): ChatCommand[] {
  return Object.values(ChatCommandsProviders)
    .sort((a, b) => a.rank - b.rank)
    .map(p => p.getCommands())
    .flat();
}

export function helpPrettyChatCommands() {
  return findAllChatCommands()
    .map(cmd => ` - ${cmd.primary}` + (cmd.alternatives?.length ? ` (${cmd.alternatives.join(', ')})` : '') + `: ${cmd.description}`)
    .join('\n');
}

export function extractChatCommand(input: string): TextCommandPiece[] {
  const inputTrimmed = input.trim();

  // quick exit: command does not start with '/'
  if (!inputTrimmed.startsWith('/'))
    return [{ type: 'nocmd', value: input }];

  // The command runs up to the first whitespace (space or newline); the rest, if any, is its parameters
  const commandMatch = inputTrimmed.match(/^\/\S+/);
  const potentialCommand = commandMatch ? commandMatch[0] : inputTrimmed;

  const textAfterCommand = inputTrimmed.slice(potentialCommand.length).trimStart();

  // Check if the potential command is an actual command
  for (const provider of Object.values(ChatCommandsProviders)) {
    for (const cmd of provider.getCommands()) {
      if (cmd.primary === potentialCommand || cmd.alternatives?.includes(potentialCommand)) {

        // command needs arguments: take the rest of the input as parameters
        if (cmd.arguments?.length) return [{
          type: 'cmd',
          providerId: provider.id,
          command: potentialCommand,
          params: textAfterCommand || undefined,
          isErrorNoArgs: !textAfterCommand,
        }];

        // command without arguments, treat any text after as a separate text piece
        const pieces: TextCommandPiece[] = [{
          type: 'cmd',
          providerId: provider.id,
          command: potentialCommand,
          params: undefined,
        }];
        textAfterCommand && pieces.push({
          type: 'nocmd',
          value: textAfterCommand,
        });
        return pieces;
      }
    }
  }

  // No command found, return the entire input as text
  return [{
    type: 'nocmd',
    value: input,
  }];
}
