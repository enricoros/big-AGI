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
  menu?: true, // whether to render as a MenuList (or as a Box otherwise)
  anchorEl: HTMLElement | null,
  onClose: () => void,

  // looks
  size?: 'sm' | 'md' | 'lg', // if set, overrides 'dense' and applies to the MenuList
  dense?: boolean,
  bigIcons?: boolean,
  boxShadow?: string, // boxShadow style, defaults to 'md'

  // behavior changes
  disableMenuTypeahead?: boolean, // disable alphanumeric typeahead navigation in MenuList
  noAutoFocus?: boolean, // if true, does not auto-focus on mount

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

  const { onClose } = props;

  /**
   * Callback ref for focus management - called upon mount, to transfer focus.
   * Note: needs menuItems in there for full and good navigation of a list, as the menu expects to land focus on those items.
   */
  const autoFocusOnMount = React.useCallback((element: HTMLElement | null) => {
    if (element && props.anchorEl)
      requestAnimationFrame(() => element.focus());
  }, [props.anchorEl]);

  const handleClose = React.useCallback((event: MouseEvent | TouchEvent | React.KeyboardEvent) => {
    event.stopPropagation();
    onClose();
  }, [onClose]);

  const handleKeyDown = React.useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Tab') {
      // NOTE: the following is not needed since we fixed 'tab'
      // Close menu on Tab - this prevents focus from escaping the popup
      // while keeping the popup simple (no full focus trap implementation)
      if (props.noAutoFocus)
        handleClose(event);
    } else if (event.key === 'Escape') {
      handleClose(event);
      if (props.anchorEl)
        props.anchorEl.focus();
    } else if (props.disableMenuTypeahead && event.key.length === 1) {
      // Prevent MenuList's typeahead navigation when disabled
      event.stopPropagation();
      // event.preventDefault(); // this is needed.. e.g. typing on input boxes
    }
  }, [handleClose, props.anchorEl, props.disableMenuTypeahead, props.noAutoFocus]);


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
    boxShadow: props.boxShadow ?? 'md',
    ...(props.maxHeightGapPx !== undefined ? { maxHeight: `calc(100dvh - ${props.maxHeightGapPx}px)`, overflowY: 'auto' } : {}),
    ...(props.maxWidth !== undefined && { maxWidth: props.maxWidth }),
    ...(props.minWidth !== undefined && { minWidth: props.minWidth }),

    // MenuList customizations
    ...(!props.size && {
      '--ListItem-minHeight': props.dense
        ? '2.25rem' /* 2.25 is the default */
        : '2.5rem', /* we enlarge the default  */
    }),
    ...(props.bigIcons && {
      '--Icon-fontSize': 'var(--joy-fontSize-xl2)',
      // '--ListItemDecorator-size': '2.75rem',
    }),
    ...(props.noBottomPadding && { pb: 0 }),
    ...(props.noTopPadding && { pt: 0 }),

    // inject
    ...(props.sx || {}),

  }), [props.boxShadow, props.maxHeightGapPx, props.maxWidth, props.minWidth, props.size, props.dense, props.bigIcons, props.noBottomPadding, props.noTopPadding, props.sx]);


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
          <MenuList ref={props.noAutoFocus ? undefined : autoFocusOnMount} size={props.size} onKeyDown={handleKeyDown} sx={styleMemoSx}>
            {props.children}
          </MenuList>
        ) : (
          <Box ref={props.noAutoFocus ? undefined : autoFocusOnMount} onKeyDown={handleKeyDown} sx={styleMemoSx}>
            {props.children}
          </Box>
        )}
      </ClickAwayListener>
    </Popup>
  );
}