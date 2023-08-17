import * as React from 'react';

import { Alert, Typography } from '@mui/joy';

export function InlineError(props: { error: React.JSX.Element | null | any, severity?: 'warning' | 'danger' }) {
  return <Alert variant='soft' color={props.severity || 'warning'} sx={{ mt: 1 }}>
    <Typography level='body-sm' color={props.severity || 'warning'}>
      {props.error?.message || props.error || 'Unknown error'}
    </Typography>
  </Alert>;
}
