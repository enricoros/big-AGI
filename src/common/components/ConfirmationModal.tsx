import * as React from 'react';

import { Box, Button, Divider, Typography } from '@mui/joy';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import { GoodModal } from '~/common/components/GoodModal';


/**
 * A confirmation dialog (Joy Modal)
 * Pass the question and the positive answer, and get called when it's time to close the dialog, or when the positive action is taken
 */
export function ConfirmationModal(props: {
  open?: boolean, onClose: () => void, onPositive: () => void,
  title?: string | React.JSX.Element,
  confirmationText: string | React.JSX.Element,
  positiveActionText: string
}) {
  return (
    <GoodModal
      open={props.open === undefined ? true : props.open}
      title={props.title || 'Confirmation'}
      titleStartDecorator={<WarningRoundedIcon sx={{ color: 'danger.solidBg' }} />}
      onClose={props.onClose}
      hideBottomClose
    >
      <Divider />
      <Typography level='body-md'>
        {props.confirmationText}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 2 }}>
        <Button autoFocus variant='plain' color='neutral' onClick={props.onClose}>
          Cancel
        </Button>
        <Button variant='solid' color='danger' onClick={props.onPositive} sx={{ lineHeight: '1.5em' }}>
          {props.positiveActionText}
        </Button>
      </Box>
    </GoodModal>
  );
}