import * as React from 'react';

import { Chip, ColorPaletteProp, VariantProp } from '@mui/joy';

import { VChatMessageIn } from '~/modules/llms/llm.client';

export function TranscriptMessage(props: {
  text?: string | React.JSX.Element,
  role: VChatMessageIn['role'],
  color?: ColorPaletteProp,
  variant?: VariantProp,
}) {
  return <Chip
    color={props.color} variant={props.variant}
    sx={{
      alignSelf: props.role === 'user' ? 'end' : 'start',
      whiteSpace: 'break-spaces',
      borderRadius: 'lg',
      mt: 'auto',
      py: 1,
    }}>
    {props.text}
  </Chip>;
}