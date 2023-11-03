import * as React from 'react';
import Image from 'next/image';

import { Box, CircularProgress } from '@mui/joy';


/**
 * 64x64 logo with a circular progress indicator around it
 */
export function LogoProgress(props: { showProgress: boolean }) {
  return <Box sx={{
    width: 64,
    height: 64,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }}>
    <Box sx={{ position: 'absolute', mt: 0.75 }}>
      <Image src='/icons/favicon-32x32.png' alt='App Logo' width={32} height={32} />
    </Box>
    {props.showProgress && <CircularProgress size='lg' sx={{ position: 'absolute' }} />}
  </Box>;
}