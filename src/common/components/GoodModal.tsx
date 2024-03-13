import * as React from 'react';

import { Box, Button, Divider, Modal, ModalClose, ModalDialog, ModalOverflow, Typography } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';


/**
 * Base for our Modal components (Preferences, Models Setup, etc.)
 */
export function GoodModal(props: {
  title?: React.ReactNode,
  titleStartDecorator?: React.JSX.Element,
  strongerTitle?: boolean,
  noTitleBar?: boolean,
  dividers?: boolean,
  open: boolean,
  onClose?: () => void,
  hideBottomClose?: boolean,
  startButton?: React.JSX.Element,
  sx?: SxProps,
  children: React.ReactNode,
}) {
  const showBottomClose = !!props.onClose && props.hideBottomClose !== true;
  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      // slotProps={{
      //   backdrop: {
      //     sx: {
      //       animation: `${cssBackgroundFadeIn} 0.2s ease-in-out`,
      //       backdropFilter: 'blur(6px)',
      //     },
      //   },
      // }}
    >
      <ModalOverflow sx={{ p: 1 }}>
        <ModalDialog
          sx={{
            minWidth: { xs: 360, sm: 500, md: 600, lg: 700 },
            maxWidth: 700,
            display: 'grid', gap: 'var(--Card-padding)',
            ...props.sx,
          }}>

          {!props.noTitleBar && <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography component='h1' level={props.strongerTitle !== true ? 'title-md' : 'title-lg'} startDecorator={props.titleStartDecorator}>
              {props.title || ''}
            </Typography>
            {!!props.onClose && <ModalClose aria-label='Close Dialog' sx={{ position: 'static', my: -1, mr: -0.5 }} />}
          </Box>}

          {props.dividers === true && <Divider />}

          {/*<Box sx={{ maxHeight: '80lvh', overflowY: 'auto', display: 'grid', gap: 'var(--Card-padding)' }}>*/}
          {props.children}
          {/*</Box>*/}

          {props.dividers === true && <Divider />}

          {(!!props.startButton || showBottomClose) && <Box sx={{ mt: 'auto', display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'space-between' }}>
            {props.startButton}
            {showBottomClose && <Button aria-label='Close Dialog' variant='solid' color='neutral' onClick={props.onClose} sx={{ ml: 'auto', minWidth: 100 }}>
              Close
            </Button>}
          </Box>}

        </ModalDialog>
      </ModalOverflow>
    </Modal>
  );
}
