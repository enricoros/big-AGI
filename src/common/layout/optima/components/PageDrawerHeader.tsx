import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { IconButton, Sheet, Typography } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';


export const PageDrawerHeader = (props: {
  title: string,
  onClose: () => void,
  sx?: SxProps,
  children?: React.ReactNode,
}) =>
  <Sheet
    variant='outlined'
    // invertedColors
    sx={{
      minHeight: 'var(--AGI-Nav-width)',

      // content
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      px: 1,

      // style
      borderTop: 'none',
      borderLeft: 'none',
      borderRight: 'none',
      // borderTopRightRadius: 'var(--AGI-Optima-Radius)',
    }}
  >

    {props.children || <IconButton disabled />}

    <Typography level='title-md'>
      {props.title}
    </Typography>

    <IconButton aria-label='Close Drawer' size='sm' onClick={props.onClose}>
      <CloseRoundedIcon />
    </IconButton>

  </Sheet>;