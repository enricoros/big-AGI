import FormatPaintIcon from '@mui/icons-material/FormatPaint';

import type { ICommandsProvider } from './ICommandsProvider';

export const CommandsDraw: ICommandsProvider = {
  id: 'ass-t2i',
  rank: 10,

  getCommands: () => [{
    primary: '/draw',
    alternatives: ['/imagine', '/img'],
    description: 'Generate an image from text',
    Icon: FormatPaintIcon,
  }],

};
