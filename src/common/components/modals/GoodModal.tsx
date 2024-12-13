import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ColorPaletteProp, Divider, Modal, ModalClose, ModalDialog, ModalOverflow, Typography } from '@mui/joy';


export const noBackdropSlotProps = {
  backdrop: {
    sx: {
      backdropFilter: 'none',
    },
  },
};


/**
 * Base for our Modal components (Preferences, Models Setup, etc.)
 */
export function GoodModal(props: {
  title?: React.ReactNode,
  titleStartDecorator?: React.JSX.Element,
  strongerTitle?: boolean,
  noTitleBar?: boolean,
  dividers?: boolean,
  themedColor?: ColorPaletteProp,
  closeText?: string, // defaults to 'Close'
  animateEnter?: boolean,
  unfilterBackdrop?: boolean, // this should be left to the theme, but we're gonna use it for the models
  open: boolean,
  onClose?: () => void,
  hideBottomClose?: boolean,
  startButton?: React.JSX.Element,
  sx?: SxProps,
  children: React.ReactNode,
}) {
  const showBottomClose = !!props.onClose && props.hideBottomClose !== true;

  const dialogSx: SxProps = React.useMemo(() => ({
    borderRadius: 'xl',
    boxShadow: props.themedColor ? 'none' : undefined,
    minWidth: { xs: 360, sm: 500, md: 600, lg: 700 },
    maxWidth: 700,
    display: 'grid',
    gap: 'var(--Card-padding)',
    ...props.sx,
  }), [props.sx, props.themedColor]);

  const backdropSx = React.useMemo(() => {
    return props.themedColor ? {
      backdrop: {
        sx: {
          backgroundColor: `rgba(var(--joy-palette-${props.themedColor}-darkChannel) / 0.3)`,
          backdropFilter: props.unfilterBackdrop ? 'none' : 'blur(32px)',
        },
      },
    } : props.unfilterBackdrop ? noBackdropSlotProps : undefined;
  }, [props.themedColor, props.unfilterBackdrop]);

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      slotProps={backdropSx}
    >
      <ModalOverflow sx={{ p: 1 }}>
        <ModalDialog
          color={props.themedColor}
          variant={props.themedColor ? 'soft' : 'plain' /* switched from bordered (undefined) to borderless (plain) */}
          invertedColors={props.themedColor ? true : undefined}
          className={props.animateEnter ? 'agi-animate-enter' : ''}
          sx={dialogSx}
        >

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

          {props.dividers === true && (!!props.startButton || showBottomClose) && <Divider />}

          {(!!props.startButton || showBottomClose) && <Box sx={{ mt: 'auto', display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'space-between' }}>
            {props.startButton}
            {showBottomClose && <Button aria-label='Close Dialog' variant='solid' color='neutral' onClick={props.onClose} sx={{ ml: 'auto', minWidth: 100 }}>
              {props.closeText || 'Close'}
            </Button>}
          </Box>}

        </ModalDialog>
      </ModalOverflow>
    </Modal>
  );
}
