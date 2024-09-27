import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, IconButton, Typography } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';


export const OptimaDrawerHeader = (props: {
  title: string,
  onClose: () => void,
  sx?: SxProps,
  children?: React.ReactNode,
}) =>
  <Box
    // variant='soft'
    // invertedColors
    sx={{
      minHeight: 'var(--AGI-Nav-width)',
      px: 1,

      // style
      backgroundColor: 'background.popup',
      // borderLeft: 'none',
      // borderRight: 'none',
      // borderTop: 'none',
      // borderTopRightRadius: 'var(--AGI-Optima-Radius)',

      // layout
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}
  >

    {props.children || <IconButton disabled />}

    <Typography level='title-md'>
      {props.title}
    </Typography>

    <IconButton aria-label='Close Drawer' size='sm' onClick={props.onClose}>
      <CloseRoundedIcon />
    </IconButton>

  </Box>;