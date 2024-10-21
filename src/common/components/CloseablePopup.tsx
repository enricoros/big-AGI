import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, MenuList, styled } from '@mui/joy';
import { ClickAwayListener, Popper, PopperPlacementType } from '@mui/base';


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
export function CloseablePopup(props: {
  menu?: boolean, // whether to render as a MenuList (or as a Box otherwise)
  anchorEl: HTMLElement | null,
  onClose: () => void,

  // looks
  dense?: boolean,
  bigIcons?: boolean,

  placement?: PopperPlacementType,
  maxHeightGapPx?: number,
  noTopPadding?: boolean,
  noBottomPadding?: boolean,
  minWidth?: number,
  maxWidth?: number,
  zIndex?: number,
  sx?: SxProps,

  // unused
  placementOffset?: number[],

  children?: React.ReactNode,
}) {

  const handleClose = (event: MouseEvent | TouchEvent | React.KeyboardEvent) => {
    event.stopPropagation();
    props.onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Tab') {
      handleClose(event);
    } else if (event.key === 'Escape') {
      if (props.anchorEl)
        props.anchorEl?.focus();
      handleClose(event);
    }
  };


  // memos
  const modifiersMemo = React.useMemo(() => [{
    name: 'offset',
    options: {
      offset: props.placementOffset || [0, 4],
    },
  }], [props.placementOffset]);

  const styleMemoSx: SxProps = React.useMemo(() => ({

    // style
    backgroundColor: 'background.popup',
    boxShadow: 'md',
    ...(props.maxHeightGapPx !== undefined ? { maxHeight: `calc(100dvh - ${props.maxHeightGapPx}px)`, overflowY: 'auto' } : {}),
    ...(props.maxWidth !== undefined && { maxWidth: props.maxWidth }),
    ...(props.minWidth !== undefined && { minWidth: props.minWidth }),

    // MenuList customizations
    '--ListItem-minHeight': props.dense
      ? '2.25rem' /* 2.25 is the default */
      : '2.5rem', /* we enlarge the default  */
    ...(props.bigIcons && {
      '--Icon-fontSize': 'var(--joy-fontSize-xl2)',
      // '--ListItemDecorator-size': '2.75rem',
    }),
    ...(props.noBottomPadding && { pb: 0 }),
    ...(props.noTopPadding && { pt: 0 }),

    // inject
    ...(props.sx || {}),

  }), [props.dense, props.bigIcons, props.maxHeightGapPx, props.maxWidth, props.minWidth, props.noBottomPadding, props.noTopPadding, props.sx]);


  return (
    <Popup
      role={undefined}
      open={!!props.anchorEl}
      anchorEl={props.anchorEl}
      placement={props.placement}
      disablePortal={false}
      modifiers={modifiersMemo}
      sx={props.zIndex ? { zIndex: props.zIndex } : undefined}
    >
      <ClickAwayListener onClickAway={handleClose}>
        {props.menu ? (
          <MenuList onKeyDown={handleKeyDown} sx={styleMemoSx}>
            {props.children}
          </MenuList>
        ) : (
          <Box onKeyDown={handleKeyDown} sx={styleMemoSx}>
            {props.children}
          </Box>
        )}
      </ClickAwayListener>
    </Popup>
  );
}