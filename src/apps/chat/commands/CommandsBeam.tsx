import { ChatBeamIcon } from '~/common/components/icons/ChatBeamIcon';

import type { ICommandsProvider } from './ICommandsProvider';

export const CommandsBeam: ICommandsProvider = {
  id: 'ass-beam',
  rank: 9,

  getCommands: () => [{
    primary: '/beam',
    arguments: ['prompt'],
    description: 'Best of multiple replies',
    Icon: ChatBeamIcon,
  }],
};
