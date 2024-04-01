import { ChatBeamIcon } from '~/common/components/icons/ChatBeamIcon';
import { useUXLabsStore } from '~/common/state/store-ux-labs';

import type { ICommandsProvider } from './ICommandsProvider';

export const CommandsBeam: ICommandsProvider = {
  id: 'mode-beam',
  rank: 9,

  getCommands: () => useUXLabsStore.getState().labsBeam ? [{
    primary: '/beam',
    arguments: ['prompt'],
    description: 'Combine the smarts of models',
    Icon: ChatBeamIcon,
  }] : [],

};
