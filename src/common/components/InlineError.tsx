import * as React from 'react';

import { Alert, ColorPaletteProp, Typography } from '@mui/joy';

export function InlineError(props: { error: any, severity?: 'warning' | 'error' }) {
  return <Alert variant='soft' color={(props.severity as ColorPaletteProp) || 'warning'} sx={{ mt: 1 }}>
    <Typography level='body-sm' color={(props.severity as ColorPaletteProp) || 'warning'}>
      {props.error?.message || props.error?.toString() || 'Unknown error'}
    </Typography>
  </Alert>;
}
