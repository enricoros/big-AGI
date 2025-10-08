import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ColorPaletteProp, Divider, IconButton, Modal, ModalClose, ModalDialog, ModalOverflow, Typography } from '@mui/joy';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';


export const darkerBackdropSlotProps = {
  backdrop: {
    sx: {
      backgroundColor: 'rgba(var(--joy-palette-neutral-darkChannel, 11 13 14) / 0.5)',
      // backdropFilter: 'none',
      // backdropFilter: 'blur(2px)',
    },
  },
};

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
  darkerBackdrop?: boolean,
  unfilterBackdrop?: boolean, // this should be left to the theme, but we're gonna use it for the models
  /**
   * Intended to enable scrolling of individual scrollable child components.
   * Has the side effects of making the full dialog scrollable below minimum contents height (withing the rounded corners basically).
   */
  autoOverflow?: boolean,
  /**
   * Show as fullscreen, ideal for mobile with large contents.
   */
  fullscreen?: boolean | 'button', // 'button' adds a button to toggle maximized (when uncontrolled)
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

  // state
  const [isFullscreen, setIsFullscreen] = React.useState(props.fullscreen === true);

  const { onClose } = props;
  const showBottomClose = !!onClose && props.hideBottomClose !== true;

  // fullscreen logic
  const hasFullscreenButton = props.fullscreen === 'button';
  const showFullscreen = hasFullscreenButton ? isFullscreen : props.fullscreen === true;

  const toggleFullscreen = React.useCallback(() => setIsFullscreen(prev => !prev), []);


  const dialogSx: SxProps = React.useMemo(() => ({
    borderRadius: 'xl',
    ...(!showFullscreen ? {
      // Centered styling
      boxShadow: props.themedColor ? 'none' : undefined,
      minWidth: { xs: 360, sm: 500, md: 600, lg: 700 },
      maxWidth: { xs: '95vw', sm: '90vw', md: 700 }, // maxWidth note: 'display: flex' fills to maxWidth rather than maxWidth which created overflow in smaller screens
    } : {
      // Fullscreen styling: no changes over the layout='fullscreen' defaults
      boxShadow: 'none', // removes the shadow in fullscreen
    }),
    // NOTE: we are disabling this which was introduced for #401 to keep the content withing bounds, while the issue was the larger maxWidth being filled by flex
    // display: 'grid', // default: 'flex', flexDirection: 'column'
    gap: 'var(--Card-padding)',
    // apply autoOverflow if set, otherwise leave the default behavior
    ...(props.autoOverflow ? {
      // maxHeight: '80lvh',
      overflow: 'auto',
    } : {}),
    ...props.sx,
    // reset any maxWidth set above when in fullscreen
    ...showFullscreen && {
      maxWidth: undefined,
    },
  }), [props.autoOverflow, showFullscreen, props.sx, props.themedColor]);

  const modalProps = React.useMemo(() => {
    return props.themedColor ? {
      backdrop: {
        sx: {
          backgroundColor: `rgba(var(--joy-palette-${props.themedColor}-darkChannel) / 0.3)`,
          backdropFilter: props.unfilterBackdrop ? 'none' : 'blur(32px)',
        },
      },
    } : props.darkerBackdrop ? darkerBackdropSlotProps : props.unfilterBackdrop ? noBackdropSlotProps : undefined;
  }, [props.darkerBackdrop, props.themedColor, props.unfilterBackdrop]);


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
      slotProps={modalProps}
    >
      <ModalOverflow>
        <ModalDialog
          color={props.themedColor}
          variant={props.themedColor ? 'soft' : 'plain' /* switched from bordered (undefined) to borderless (plain) */}
          layout={showFullscreen ? 'fullscreen' : 'center'}
          invertedColors={props.themedColor ? true : undefined}
          className={props.animateEnter ? 'agi-animate-enter' : ''}
          onMouseDown={handleMouseDownWithinDialog /* to fix the Backdrop drag-closes issue */}
          sx={dialogSx}
        >

          {!props.noTitleBar && <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

            {/* title string or component (wrapped in h1) */}
            <Typography component='h3' level={props.strongerTitle !== true ? 'title-md' : 'title-lg'} startDecorator={props.titleStartDecorator} className='agi-ellipsize'>
              {props.title || ''}
            </Typography>

            {/* buttons */}
            {(hasFullscreenButton || !!props.onClose) && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: -0.5 }}>
                {/* optional fullscreen button */}
                {hasFullscreenButton && (
                  <IconButton aria-label={showFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'} size='sm' onClick={toggleFullscreen} sx={{ my: -1 }}>
                    {showFullscreen ? <CloseFullscreenIcon /> : <OpenInFullIcon sx={{ fontSize: 'md' }} />}
                  </IconButton>
                )}
                {/* optional close button */}
                {!!props.onClose && <ModalClose aria-label='Close Dialog' sx={{ position: 'static', my: -1 }} />}
              </Box>
            )}

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
