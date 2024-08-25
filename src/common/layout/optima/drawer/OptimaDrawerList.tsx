import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { ColorPaletteProp, List, VariantProp } from '@mui/joy';


export const PageDrawerTallItemSx: SxProps = {
  // TODO: start from this to update the buttons/listbuttons sizes and have uniformity
  '--ListItem-minHeight': '2.75rem',
};


/**
 * Used by pluggable layouts to have a standardized list appearance
 */
export function OptimaDrawerList(props: {
  variant?: VariantProp,
  color?: ColorPaletteProp,
  onClick?: () => void,
  largeIcons?: boolean,
  tallRows?: boolean,
  noTopPadding?: boolean,
  noBottomPadding?: boolean,
  children: React.ReactNode
}) {


  // memoize the Sx for stability
  const sx: SxProps = React.useMemo(() => ({
    // size of the list items
    '--List-radius': 0,
    ...props.largeIcons && {
      '--Icon-fontSize': 'var(--joy-fontSize-xl2)',
      // '--ListItemDecorator-size': '2.75rem', // icon width
    },
    ...(props.tallRows && PageDrawerTallItemSx),

    // style
    backgroundColor: 'background.popup',
    border: 'none',
    // borderBottomRightRadius: 'var(--AGI-Optima-Radius)',
    ...(!!props.noTopPadding && { pt: 0 }),
    ...(!!props.noBottomPadding && { pb: 0 }),

    // clipping/scrolling
    overflow: 'hidden',
  }), [props.largeIcons, props.tallRows, props.noTopPadding, props.noBottomPadding]);


  return (
    <List
      variant={props.variant}
      color={props.color}
      onClick={props.onClick}
      sx={sx}
    >
      {props.children}
    </List>
  );
}