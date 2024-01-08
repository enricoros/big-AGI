import LanguageIcon from '@mui/icons-material/Language';

import type { ICommandsProvider } from './ICommandsProvider';

export const CommandsBrowse: ICommandsProvider = {
  id: 'ass-browse',
  rank: 25,

  getCommands: () => [{
    primary: '/browse',
    arguments: ['URL'],
    description: 'Assistant will download the web page',
    Icon: LanguageIcon,
  }],

};
