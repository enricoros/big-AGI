import FormatPaintTwoToneIcon from '@mui/icons-material/FormatPaintTwoTone';

import type { ICommandsProvider } from './ICommandsProvider';

export function textToDrawCommand(text: string): string {
  return `/draw ${text}`;
}

export const CommandsDraw: ICommandsProvider = {
  id: 'cmd-ass-t2i',
  rank: 10,

  getCommands: () => [{
    primary: '/draw',
    alternatives: ['/imagine', '/img'],
    arguments: ['prompt'],
    description: 'Assistant will draw the text',
    Icon: FormatPaintTwoToneIcon,
  }],

};
