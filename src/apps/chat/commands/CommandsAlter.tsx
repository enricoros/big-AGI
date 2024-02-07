import ClearIcon from '@mui/icons-material/Clear';

import type { ICommandsProvider } from './ICommandsProvider';

export const CommandsAlter: ICommandsProvider = {
  id: 'chat-alter',
  rank: 25,

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
  }, {
    primary: '/clear',
    arguments: ['all'],
    description: 'Clears the chat (removes all messages)',
    Icon: ClearIcon,
  }],

};
