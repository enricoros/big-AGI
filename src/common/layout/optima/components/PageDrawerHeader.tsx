import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { IconButton, Sheet, Typography } from '@mui/joy';
import CloseIcon from '@mui/icons-material/Close';


export const PageDrawerHeader = (props: {
  title: string,
  onClose: () => void,
  startButton?: React.ReactNode,
  sx?: SxProps
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
    }}
  >

    {props.startButton
      ? props.startButton
      : <IconButton disabled />}

    <Typography level='title-md'>
      {props.title}
    </Typography>

    <IconButton onClick={props.onClose}>
      <CloseIcon />
    </IconButton>

  </Sheet>;