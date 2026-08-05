import * as React from 'react';
import { keyframes } from '@emotion/react';

import type { ColorPaletteProp, SxProps, VariantProp } from '@mui/joy/styles/types';
import { Box, Button, IconButton, ListItemDecorator, Menu, MenuButton, MenuItem } from '@mui/joy';

import { themeZIndexOverMobileDrawer } from '~/common/app.theme';


/**
 * RichMenu family: the app-wide trigger-button + dropdown-menu pattern.
 *
 * Two presentations, uniform across all adopters (attachment sources, prompts, voice engines, ...):
 * - rich (desktop): labeled pill trigger that docks to a rounded, bordered, animated menu
 * - compact (mobile): icon trigger with the default squared menu
 *
 * Components (for `Dropdown` usage): `RichMenuButton`, `RichMenu`, `RichMenuItem`.
 * Style primitives (for controlled popups, e.g. `CloseablePopup`): `richMenuSx`, `richMenuCompactSx`.
 */


// configuration
export const RICH_MENU_BUTTON_RADIUS = '18px'; // pill trigger and rich menu corners - single knob for the family
const RICH_MENU_MIN_WIDTH = 280;
const PILL_MIN_WIDTH = 100;


// animations: whole-menu fade, per-item slide-in (staggered per-item via nth-of-type, no wiring needed)
const animationMenuEnter = keyframes` from {opacity: 0;} to {opacity: 1;}`;
const animationItemEnter = keyframes` from {opacity: 0;transform: translateY(-6px);} to {opacity: 1;transform: translateY(0);}`;
const ANIMATION_EASE = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';

const _itemStaggerSx = (() => {
  const stagger: Record<string, { animationDelay: string }> = {};
  for (let i = 2; i <= 14; i++)
    stagger[`& li:nth-of-type(${i})`] = { animationDelay: `${((i - 1) * 0.02).toFixed(2)}s` };
  return stagger;
})();


/// Menu surface styles ///

/**
 * The rich (desktop) menu surface chrome.
 * Exported for controlled popups (CloseablePopup) to match RichMenu exactly; no zIndex (popper-level concern).
 */
export function richMenuSx(color?: ColorPaletteProp) {
  return {
    minWidth: RICH_MENU_MIN_WIDTH,
    '--List-padding': '0.5rem',
    animation: `${animationMenuEnter} 0.12s ${ANIMATION_EASE}`,
    boxShadow: 'md',
    borderRadius: RICH_MENU_BUTTON_RADIUS,
    border: '1px solid',
    borderColor: `${color || 'neutral'}.outlinedBorder`,
    backgroundColor: 'background.popup',
    overflow: 'hidden',
  } satisfies SxProps;
}

// staggered per-item entrance ('both' keeps later items hidden until their delay) - opt-in via <RichMenu stagger>
const _richMenuStaggerSx = {
  '& li': { animation: `${animationItemEnter} 0.12s ${ANIMATION_EASE} both` },
  ..._itemStaggerSx,
} satisfies SxProps;

/** The compact (mobile) menu surface: default squared Joy menu, just consistent padding. */
export const richMenuCompactSx = {
  '--List-padding': '0.5rem',
} as const satisfies SxProps;


/// Trigger button ///

/**
 * Trigger for a RichMenu - must be a child of `Dropdown`.
 * With a `label`: the desktop pill (full width, left aligned, flattens its top corners while the menu is open).
 * Without: a plain IconButton trigger (mobile).
 */
export function RichMenuButton(props: {
  icon?: React.ReactNode,
  label?: undefined | React.ReactNode,
  color?: ColorPaletteProp,
  variant?: VariantProp, // icon trigger only - the pill is always 'plain' (+ optional standOut chrome)
  standOut?: boolean, // pill only: popup background + border, to detach from busy backdrops
  disabled?: boolean,
  sx?: SxProps,
}) {

  // icon trigger (mobile)
  if (props.label === undefined)
    return (
      <MenuButton slots={{ root: IconButton }} slotProps={{
        root: {
          color: props.color,
          variant: props.variant,
          disabled: props.disabled,
          sx: {
            // menu open: soft pressed look (mirrors the pill's expanded state)
            '&[aria-expanded="true"]': {
              // borderTopRightRadius: 0,
              // borderTopLeftRadius: 0,
              backgroundColor: `${props.color || 'neutral'}.softHoverBg`,
            },
            ...props.sx,
          },
        },
      }}>
        {props.icon}
      </MenuButton>
    );

  // pill trigger (desktop)
  return (
    <MenuButton
      slots={{ root: Button }}
      slotProps={{
        root: {
          variant: 'plain',
          color: props.color,
          disabled: props.disabled,
          startDecorator: props.icon,
          fullWidth: true, // to match other buttons in the col
          sx: {
            minWidth: PILL_MIN_WIDTH,
            justifyContent: 'flex-start',
            borderRadius: RICH_MENU_BUTTON_RADIUS,
            textWrap: 'nowrap',
            ...(props.standOut && {
              backgroundColor: 'background.popup',
              border: '1px solid',
              borderColor: `${props.color || 'neutral'}.outlinedBorder`,
            }),
            // menu open: dock to the menu (flatten top corners)
            '&[aria-expanded="true"]': {
              borderTopRightRadius: 0,
              borderTopLeftRadius: 0,
              backgroundColor: `${props.color || 'neutral'}.softHoverBg`,
            },
            ...props.sx,
          },
        },
      }}
    >
      {props.label}
    </MenuButton>
  );
}


/// Menu surface ///

const _richPopperOptions = {
  modifiers: [{ name: 'offset', options: { offset: [-10, -2] } }], // slight overlap to dock onto the pill
};

/**
 * Menu surface for a RichMenu - must be a child of `Dropdown`.
 * Rich (default): docks on top of the pill trigger with the polished chrome.
 * Compact: the default Joy menu look (mobile).
 */
export function RichMenu(props: {
  compact?: boolean,
  stagger?: boolean, // staggered item entrance - for click-opened menus with many items
  color?: ColorPaletteProp,
  placement?: 'top-start' | 'top' | 'top-end' | 'bottom-start' | 'bottom' | 'bottom-end',
  zIndex?: number,
  sx?: SxProps,
  children: React.ReactNode,
}) {

  const zIndex = props.zIndex ?? themeZIndexOverMobileDrawer; // above dialogs that may host the trigger

  if (props.compact)
    return (
      <Menu placement={props.placement} sx={{ ...richMenuCompactSx, ...(props.stagger && _richMenuStaggerSx), zIndex, ...props.sx }}>
        {props.children}
      </Menu>
    );

  return (
    <Menu
      color={props.color}
      placement={props.placement ?? 'top-start'}
      popperOptions={_richPopperOptions}
      sx={{ ...richMenuSx(props.color), ...(props.stagger && _richMenuStaggerSx), zIndex, ...props.sx }}
    >
      {props.children}
    </Menu>
  );
}


/// Menu items ///

/**
 * Item styles, exported for custom rows that must align with RichMenuItem
 * (e.g. checkbox/toggle ListItems within the same menu).
 */
export const richMenuItemSx = {
  item: {
    py: 0.5,
    minHeight: 60,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0.125,
  },
  contentDisabled: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0.125,
    opacity: 0.5,
  },
  name: {
    typography: 'title-sm',
    fontWeight: 600,
  },
  description: {
    fontSize: 'xs',
    color: 'text.tertiary',
  },
  endAction: {
    ml: 'auto',
    display: 'flex',
    alignItems: 'center',
  },
} as const satisfies Record<string, SxProps>;

/**
 * The uniform two-line menu item: icon, name, optional description, optional end action.
 * Entrance animation is owned by the rich menu surface, not the item.
 */
export function RichMenuItem(props: {
  name: React.ReactNode;
  description?: React.ReactNode;
  Icon?: React.ComponentType; // when absent, an empty decorator keeps text alignment
  onClick: () => void;
  disabled?: boolean;
  selected?: boolean;
  color?: ColorPaletteProp;
  endAction?: React.ReactNode;
}) {
  return (
    <MenuItem
      onClick={props.onClick}
      disabled={props.disabled}
      selected={props.selected}
      color={props.color}
      sx={richMenuItemSx.item}
    >
      <ListItemDecorator>
        {props.Icon && <props.Icon />}
      </ListItemDecorator>
      <Box sx={props.disabled ? richMenuItemSx.contentDisabled : richMenuItemSx.content}>
        <Box sx={richMenuItemSx.name}>
          {props.name}
        </Box>
        {props.description !== undefined && (
          <Box sx={richMenuItemSx.description}>
            {props.description}
          </Box>
        )}
      </Box>
      {props.endAction && (
        <Box sx={richMenuItemSx.endAction}>
          {props.endAction}
        </Box>
      )}
    </MenuItem>
  );
}
