import * as React from 'react';

import { Chip, ColorPaletteProp, VariantProp } from '@mui/joy';
import { SxProps } from '@mui/system';

import { VChatMessageIn } from '~/modules/llms/transports/chatGenerate';


export function CallMessage(props: {
  text?: string | React.JSX.Element,
  variant?: VariantProp, color?: ColorPaletteProp,
  role: VChatMessageIn['role'],
  sx?: SxProps,
}) {
  return (
    <Chip
      color={props.color} variant={props.variant}
      sx={{
        alignSelf: props.role === 'user' ? 'end' : 'start',
        whiteSpace: 'break-spaces',
        borderRadius: 'lg',
        mt: 'auto',
        // boxShadow: 'md',
        py: 1,
        ...(props.sx || {}),
      }}
    >

      {props.text}

    </Chip>
  );
}