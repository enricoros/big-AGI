import type { ICommandsProvider } from './ICommandsProvider';

export const CommandsAlter: ICommandsProvider = {
  id: 'chat-alter',
  rank: 20,

  getCommands: () => [{
    primary: '/assistant',
    alternatives: ['/a'],
    arguments: ['text'],
    description: 'Injects assistant response',
  }, {
    primary: '/system',
    alternatives: ['/s'],
    arguments: ['text'],
    description: 'Injects system message',
  }],

};
