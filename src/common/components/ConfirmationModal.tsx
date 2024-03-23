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
  noTitleBar?: boolean,
  lowStakes?: boolean,
  confirmationText: string | React.JSX.Element,
  positiveActionText: React.ReactNode,
  negativeActionText?: React.ReactNode,
  negativeActionStartDecorator?: React.ReactNode,
}) {
  return (
    <GoodModal
      open={props.open === undefined ? true : props.open}
      title={props.noTitleBar ? undefined : (props.title || 'Confirmation')}
      titleStartDecorator={props.noTitleBar ? undefined : <WarningRoundedIcon sx={{ color: 'danger.solidBg' }} />}
      noTitleBar={props.noTitleBar}
      onClose={props.onClose}
      hideBottomClose
    >
      {!props.noTitleBar && <Divider />}

      <Typography level='body-md'>
        {props.confirmationText}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 2 }}>
        <Button autoFocus variant='plain' color='neutral' onClick={props.onClose} startDecorator={props.negativeActionStartDecorator}>
          {props.negativeActionText || 'Cancel'}
        </Button>
        <Button
          variant={props.lowStakes ? 'soft' : 'solid'}
          color={props.lowStakes ? undefined : 'danger'}
          onClick={props.onPositive}
          sx={{ lineHeight: '1.5em' }}
        >
          {props.positiveActionText}
        </Button>
      </Box>
    </GoodModal>
  );
}