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
  /** if true, if true, forces contents to stay within the screen viewport, inner scrollable (not outer) */
  autoOverflow?: boolean,
  open: boolean,
  onClose?: ((event: React.BaseSyntheticEvent, reason: 'backdropClick' | 'escapeKeyDown' | 'closeClick') => void) | undefined,
  disableBackdropClose?: boolean, // if true, the backdrop will not close the modal on click
  disableEscapeKeyClose?: boolean, // if true, the escape key will not close the modal
  hideBottomClose?: boolean,
  darkBottomClose?: boolean,
  startButton?: React.JSX.Element,
  /** sx of the ModalDialog (Modal > ModalOverflow > ModalDialog), not the Modal */
  sx?: SxProps,
  children: React.ReactNode,
}) {

  const { onClose } = props;
  const showBottomClose = !!onClose && props.hideBottomClose !== true;

  const dialogSx: SxProps = React.useMemo(() => ({
    borderRadius: 'xl',
    boxShadow: props.themedColor ? 'none' : undefined,
    minWidth: { xs: 360, sm: 500, md: 600, lg: 700 },
    maxWidth: 700,
    display: 'grid',
    gap: 'var(--Card-padding)',
    // apply autoOverflow if set, otherwise leave the default behavior
    ...(props.autoOverflow ? {
      // maxHeight: '80lvh',
      overflow: 'auto',
    } : {}),
    ...props.sx,
  }), [props.autoOverflow, props.sx, props.themedColor]);

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


  // Fix the issue where the backdrop will fire on clicks that initiated on the dialog
  const dragFromDialogRef = React.useRef(false);

  const handleMouseDownWithinDialog = React.useCallback(() => {
    dragFromDialogRef.current = true;
  }, []);

  const handleOnClose = React.useCallback((event: React.BaseSyntheticEvent, reason: 'backdropClick' | 'escapeKeyDown' | 'closeClick') => {
    // ignore clicks on the backdrop that started from within the dialog
    const ignoreDragOnBackdrop = reason === 'backdropClick' && (dragFromDialogRef.current || !!props.disableBackdropClose);
    dragFromDialogRef.current = false;
    if (ignoreDragOnBackdrop) return;

    // normal propagation
    onClose?.(event, reason);
  }, [onClose, props.disableBackdropClose]);

  return (
    <Modal
      open={props.open}
      onClose={!onClose ? undefined : handleOnClose}
      disableEscapeKeyDown={props.disableEscapeKeyClose}
      slotProps={backdropSx}
    >
      <ModalOverflow sx={{ p: 1 }}>
        <ModalDialog
          color={props.themedColor}
          variant={props.themedColor ? 'soft' : 'plain' /* switched from bordered (undefined) to borderless (plain) */}
          invertedColors={props.themedColor ? true : undefined}
          className={props.animateEnter ? 'agi-animate-enter' : ''}
          onMouseDown={handleMouseDownWithinDialog /* to fix the Backdrop drag-closes issue */}
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

          {(!!props.startButton || showBottomClose) && <Box sx={{
            mt: 'auto',
            ...props.darkBottomClose && {
              m: 'calc(-1* var(--Card-padding))',
              p: 'var(--Card-padding)',
              backgroundColor: 'background.level1',
            },
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            justifyContent: 'space-between',
          }}>
            {props.startButton}
            {showBottomClose && <Button aria-label='Close Dialog' variant='solid' color='neutral' onClick={(event) => props.onClose?.(event, 'closeClick')} sx={{ ml: 'auto', minWidth: 100 }}>
              {props.closeText || 'Close'}
            </Button>}
          </Box>}

        </ModalDialog>
      </ModalOverflow>
    </Modal>
  );
}
