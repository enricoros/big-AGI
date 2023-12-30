import type { ICommandsProvider } from './ICommandsProvider';

export const CommandsAlter: ICommandsProvider = {
  id: 'chat-alter',
  rank: 20,

  getCommands: () => [{
    primary: '/assistant',
    alternatives: ['/a'],
    description: 'Injects assistant response',
  }, {
    primary: '/system',
    alternatives: ['/s'],
    description: 'Injects system message',
  }],

};
