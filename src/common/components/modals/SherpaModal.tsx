import * as React from 'react';

import { ColorPaletteProp, Modal, ModalClose, ModalOverflow } from '@mui/joy';

import { noBackdropSlotProps } from './GoodModal';


/**
 * A simple modal that centers content and uses the 'sherpa' theme.
 */
export function SherpaModal(props: {
  themedColor?: ColorPaletteProp,
  unfilterBackdrop?: boolean,
  onClose: () => void,
  children: React.ReactNode,
}) {

  const backdropSx = React.useMemo(() => props.themedColor ? {
    backdrop: {
      sx: {
        backgroundColor: `rgba(var(--joy-palette-${props.themedColor}-darkChannel) / 0.3)`,
        backdropFilter: props.unfilterBackdrop ? 'none' : 'blur(32px)',
      },
    },
  } : props.unfilterBackdrop ? noBackdropSlotProps : undefined, [props.themedColor, props.unfilterBackdrop]);

  return (
    <Modal open onClose={props.onClose} slotProps={backdropSx}>
      <ModalOverflow>
        <ModalClose />
        {props.children}
      </ModalOverflow>
    </Modal>
  );
}
