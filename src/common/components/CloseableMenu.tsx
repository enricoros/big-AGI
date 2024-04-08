import * as React from 'react';

import { ClickAwayListener, Popper, PopperPlacementType } from '@mui/base';
import { MenuList, styled } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';


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
  dense?: boolean,
  bigIcons?: boolean,
  // variant?: VariantProp,
  // color?: ColorPaletteProp,
  // size?: 'sm' | 'md' | 'lg',
  placement?: PopperPlacementType,
  placementOffset?: number[],
  maxHeightGapPx?: number,
  noTopPadding?: boolean,
  noBottomPadding?: boolean,
  sx?: SxProps,
  zIndex?: number,
  listRef?: React.Ref<HTMLUListElement>,
  children?: React.ReactNode,
}) {

  const handleClose = (event: MouseEvent | TouchEvent | React.KeyboardEvent) => {
    event.stopPropagation();
    props.onClose();
  };

  const handleListKeyDown = (event: React.KeyboardEvent) => {
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
          offset: props.placementOffset || [0, 4],
        },
      }]}
      sx={props.zIndex
        ? { zIndex: props.zIndex }
        : {}
      }
    >
      <ClickAwayListener onClickAway={handleClose}>
        <MenuList
          ref={props.listRef}
          // variant={props.variant} color={props.color}
          onKeyDown={handleListKeyDown}
          sx={{
            '--ListItem-minHeight': props.dense
              ? '2.25rem' /* 2.25 is the default */
              : '2.5rem', /* we enlarge the default  */
            ...(props.bigIcons && {
              '--Icon-fontSize': 'var(--joy-fontSize-xl2)',
              // '--ListItemDecorator-size': '2.75rem',
            }),
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