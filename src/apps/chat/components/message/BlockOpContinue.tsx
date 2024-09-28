import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Chip, ColorPaletteProp } from '@mui/joy';

import { ScaledTextBlockRenderer } from '~/modules/blocks/ScaledTextBlockRenderer';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageId, DMessageRole } from '~/common/stores/chat/chat.message';


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
  messageId: DMessageId,
  messageRole: DMessageRole,
  onContinue: (messageId: DMessageId) => void,
}) {

  // handlers
  const { onContinue } = props;
  const handleContinue = React.useCallback(() => {
    onContinue(props.messageId);
  }, [onContinue, props.messageId]);

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
        onClick={handleContinue}
        sx={chipSx}
      >
        Continue...
      </Chip>

    </Box>
  );
}