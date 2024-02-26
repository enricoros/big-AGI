import { ChatBeamIcon } from '~/common/components/icons/ChatBeamIcon';
import { getUXLabsChatBeam } from '~/common/state/store-ux-labs';

import type { ICommandsProvider } from './ICommandsProvider';

export const CommandsBeam: ICommandsProvider = {
  id: 'ass-beam',
  rank: 9,

  getCommands: () => getUXLabsChatBeam() ? [{
    primary: '/beam',
    arguments: ['prompt'],
    description: 'Best of multiple replies',
    Icon: ChatBeamIcon,
  }] : [],

};
