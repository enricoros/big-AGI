import * as React from 'react';

import { Chip, ColorPaletteProp, VariantProp } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';

import type { VChatMessageIn } from '~/modules/llms/llm.client';


export function CallMessage(props: {
  text?: string | React.JSX.Element,
  variant?: VariantProp, color?: ColorPaletteProp,
  role: VChatMessageIn['role'],
  sx?: SxProps,
}) {
  const isUserMessage = props.role === 'user';
  return (
    <Chip
      color={props.color} variant={props.variant}
      sx={{
        alignSelf: isUserMessage ? 'end' : 'start',
        whiteSpace: 'break-spaces',
        borderRadius: 'lg',
        ...(isUserMessage ? {
          borderBottomRightRadius: 0,
        } : {
          borderBottomLeftRadius: 0,
        }),
        // boxShadow: 'md',
        py: 1,
        px: 1.5,
        ...(props.sx || {}),
      }}
    >

      {props.text}

    </Chip>
  );
}