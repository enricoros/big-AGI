import PsychologyIcon from '@mui/icons-material/Psychology';

import type { ICommandsProvider } from './ICommandsProvider';

export const CommandsReact: ICommandsProvider = {
  id: 'cmd-mode-react',
  rank: 15,

  getCommands: () => [{
    primary: '/react',
    arguments: ['prompt'],
    description: 'Use the AI ReAct strategy to answer your query',
    Icon: PsychologyIcon,
  }],

};
