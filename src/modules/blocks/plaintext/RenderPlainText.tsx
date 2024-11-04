import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Chip, Typography } from '@mui/joy';

import { extractChatCommand } from '../../../apps/chat/commands/commands.registry';


/**
 * Renders a text block with chat commands.
 * NOTE: should remove the commands parsing dependency.
 */
export const RenderPlainText = (props: { content: string; sx?: SxProps; }) => {

  const elements = extractChatCommand(props.content);

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
              <Chip component='span' size='md' variant='solid' color={element.isErrorNoArgs ? 'danger' : 'neutral'} sx={{ mr: 1 }}>
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