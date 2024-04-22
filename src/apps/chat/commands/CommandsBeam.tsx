import { ChatBeamIcon } from '~/common/components/icons/ChatBeamIcon';

import type { ICommandsProvider } from './ICommandsProvider';

export const CommandsBeam: ICommandsProvider = {
  id: 'mode-beam',
  rank: 9,

  getCommands: () => [{
    primary: '/beam',
    arguments: ['prompt'],
    description: 'Combine the smarts of models',
    Icon: ChatBeamIcon,
  }],

};
