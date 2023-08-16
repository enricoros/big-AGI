import * as React from 'react';
import { KeyboardEvent } from 'react';

import { ClickAwayListener, Popper, PopperPlacementType } from '@mui/base';
import { MenuList, styled, VariantProp } from '@mui/joy';
import { SxProps } from '@mui/system';


// adds the 'sx' prop to the Popper, and defaults zIndex to 1000
const Popup = styled(Popper)({
  zIndex: 1000,
});


/**
 * Workaround to the Menu in Joy 5-beta.0.
 *
 * This component addresses major changes in the Menu component in Joy 5-beta.0:
 *  - missing callback for onClose
 *  - clickaway listener not working
 *  - dynamic menus unsupported
 *  - ...
 */
export function CloseableMenu(props: {
  open: boolean, anchorEl: HTMLElement | null, onClose: () => void,
  variant?: VariantProp,
  // color?: ColorPaletteProp,
  // size?: 'sm' | 'md' | 'lg',
  placement?: PopperPlacementType,
  maxHeightGapPx?: number,
  noTopPadding?: boolean,
  noBottomPadding?: boolean,
  sx?: SxProps,
  zIndex?: number,
  children?: React.ReactNode,
}) {

  const handleClose = (event: MouseEvent | TouchEvent | KeyboardEvent) => {
    event.stopPropagation();
    props.onClose();
  };

  const handleListKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Tab') {
      handleClose(event);
    } else if (event.key === 'Escape') {
      if (props.anchorEl)
        props.anchorEl?.focus();
      handleClose(event);
    }
  };

  return (
    <Popup
      role={undefined}
      open={props.open && props.anchorEl !== null}
      anchorEl={props.anchorEl}
      placement={props.placement}
      disablePortal={false}
      modifiers={[{
        name: 'offset',
        options: {
          offset: [0, 4],
        },
      }]}
      sx={props.zIndex
        ? { zIndex: props.zIndex }
        : {}
      }
    >
      <ClickAwayListener onClickAway={handleClose}>
        <MenuList
          variant={props.variant}
          // color={props.color}
          onKeyDown={handleListKeyDown}
          sx={{
            '--Icon-fontSize': 'var(--joy-fontSize-xl2)',
            '--ListItem-minHeight': '3rem',
            '--ListItemDecorator-size': '2.75rem',
            backgroundColor: 'background.popup',
            boxShadow: 'md',
            ...(props.maxHeightGapPx !== undefined ? { maxHeight: `calc(100dvh - ${props.maxHeightGapPx}px)`, overflowY: 'auto' } : {}),
            ...(props.noTopPadding ? { pt: 0 } : {}),
            ...(props.noBottomPadding ? { pb: 0 } : {}),
            ...(props.sx || {}),
          }}
        >
          {props.children}
        </MenuList>
      </ClickAwayListener>
    </Popup>
  );
}