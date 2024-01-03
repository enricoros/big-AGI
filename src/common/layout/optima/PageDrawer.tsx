import * as React from 'react';

import { IconButton, Sheet, Typography } from '@mui/joy';
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
      variant='outlined'
      // invertedColors
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 'var(--AGI-Nav-width)',
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: 'none',
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

    {/* Pluggable Drawer Content */}
    {props.children}

  </>;
}