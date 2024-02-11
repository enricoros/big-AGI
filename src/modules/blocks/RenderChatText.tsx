import * as React from 'react';

import { Chip, Typography } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';

import { extractChatCommand } from '../../apps/chat/commands/commands.registry';

import type { TextBlock } from './blocks';


export const RenderChatText = (props: { textBlock: TextBlock; sx?: SxProps; }) => {

  const elements = extractChatCommand(props.textBlock.content);

  return (
    <Typography
      sx={{
        mx: 1.5,
        // display: 'flex', // Commented on 2023-12-29: the commands were drawn as columns
        alignItems: 'baseline',
        overflowWrap: 'anywhere',
        whiteSpace: 'break-spaces',
        ...props.sx,
      }}
    >
      {elements.map((element, index) =>
        <React.Fragment key={index}>
          {element.type === 'cmd'
            ? <>
              <Chip component='span' size='md' variant='solid' color={element.isError ? 'danger' : 'neutral'} sx={{ mr: 1 }}>
                {element.command}
              </Chip>
              <span>{element.params}</span>
            </>
            : <span>{element.value}</span>
          }
        </React.Fragment>,
      )}
    </Typography>
  );
};