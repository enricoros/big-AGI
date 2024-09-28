import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Chip } from '@mui/joy';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';

import { ScaledTextBlockRenderer } from '~/modules/blocks/ScaledTextBlockRenderer';

import type { ContentScaling } from '~/common/app.theme';


const containerSx: SxProps = {
  marginInlineStart: 1.5,
  backgroundColor: 'neutral.softBg',
  borderRadius: 'lg',

  // layout
  display: 'flex',
  alignItems: 'center',
  gap: 1,
};

const chipSx: SxProps = {
  px: 2,
};


export function BlockOpEmpty(props: {
  text: string,
  contentScaling: ContentScaling,
  onDelete?: () => void,
}) {

  // state
  // const { showPromisedOverlay } = useOverlayComponents();

  // derived state
  // const { onDelete } = props;

  // const handleConfirmDelete = React.useCallback(async () => {
  //   if (onDelete && await showPromisedOverlay('chat-message-delete-confirmation', { rejectWithValue: false }, ({ onResolve, onUserReject }) =>
  //     <ConfirmationModal
  //       open onClose={onUserReject} onPositive={() => onResolve(true)}
  //       confirmationText='Are you sure you want to delete this message?'
  //       positiveActionText='Delete'
  //       title='Delete Message'
  //     />,
  //   )) onDelete();
  // }, [onDelete, showPromisedOverlay]);

  return (
    <Box sx={containerSx}>

      <ScaledTextBlockRenderer
        text={props.text}
        contentScaling={props.contentScaling}
        textRenderVariant='text'
        showAsItalic
      />

      {!!props.onDelete && (
        <Chip
          color='neutral'
          variant='outlined'
          size={props.contentScaling === 'md' ? 'lg' : 'md'}
          onClick={props.onDelete}
          sx={chipSx}
          startDecorator={<DeleteForeverIcon />}
        >
          Delete
        </Chip>
      )}

    </Box>
  );
}