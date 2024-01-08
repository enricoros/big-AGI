import type { ICommandsProvider } from './ICommandsProvider';

export const CommandsHelp: ICommandsProvider = {
  id: 'cmd-help',
  rank: 99,

  getCommands: () => [{
    primary: '/help',
    alternatives: ['/?'],
    description: 'Display this list of commands',
  }],

};
