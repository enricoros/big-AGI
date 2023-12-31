import * as React from 'react';

import { IconButton, MenuList, Sheet, Typography } from '@mui/joy';
import CloseIcon from '@mui/icons-material/Close';

import type { NavItemApp } from '~/common/app.nav';


export function PageDrawer(props: {
  currentApp?: NavItemApp,
  onClick: () => void,
  children?: React.ReactNode,
}) {
  return <>

    {/* Drawer Header */}
    <Sheet
      // variant='outlined'
      // invertedColors
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 'var(--Agi-nav-width)',
        borderTop: 'none',
        px: 1,
      }}
    >
      <IconButton disabled />

      <Typography level='title-md'>
        {props.currentApp?.name || ''}s
      </Typography>

      <IconButton onClick={props.onClick}>
        <CloseIcon />
      </IconButton>
    </Sheet>

    {/* Pluggable content (Pane) */}
    <MenuList
      variant='plain'
      // variant={props.variant} color={props.color}
      // onKeyDown={handleListKeyDown}
      sx={{
        '--Icon-fontSize': 'var(--joy-fontSize-xl2)',
        '--ListItem-minHeight': /*props.dense*/ false ? '2.5rem' : '3rem',
        '--ListItemDecorator-size': '2.75rem', // icon width
        backgroundColor: 'background.popup',
        boxShadow: 'md',
        border: 'none',
        // ...(props.maxHeightGapPx !== undefined ? { maxHeight: `calc(100dvh - ${props.maxHeightGapPx}px)`, overflowY: 'auto' } : {}),
        // ...(props.noTopPadding ? { pt: 0 } : {}),
        // ...(props.noBottomPadding ? { pb: 0 } : {}),
        // ...(props.sx || {}),
      }}
    >
      {props.children}
    </MenuList>
  </>;
}