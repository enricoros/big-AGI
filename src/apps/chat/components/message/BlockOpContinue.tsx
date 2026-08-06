import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Chip, ColorPaletteProp } from '@mui/joy';

import { ScaledTextBlockRenderer } from '~/modules/blocks/ScaledTextBlockRenderer';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';


// configuration
const ACTIVE_COLOR: ColorPaletteProp = 'warning';


const containerSx: SxProps = {
  marginInlineStart: 1.5,
  backgroundColor: `${ACTIVE_COLOR}.softBg`,
  borderRadius: 'lg',
  // boxShadow: 'xs',
  // p: 0.25,

  // layout
  display: 'flex',
  alignItems: 'center',
  gap: 1,
};

const chipSx: SxProps = {
  px: 2,
};


export function BlockOpContinue(props: {
  contentScaling: ContentScaling,
  messageRole: DMessageRole,
  onContinue: (continueText: null | string) => void,
}) {

  return (
    <Box sx={containerSx}>

      <ScaledTextBlockRenderer
        text='🧱 Token limit hit.'
        contentScaling={props.contentScaling}
        textRenderVariant='text'
        // showAsItalic
      />

      <Chip
        color={ACTIVE_COLOR}
        variant='outlined'
        size={props.contentScaling === 'md' ? 'lg' : 'md'}
        onClick={() => props.onContinue(null)}
        sx={chipSx}
      >
        Continue...
      </Chip>

    </Box>
  );
}