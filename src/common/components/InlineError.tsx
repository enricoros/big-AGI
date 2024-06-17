import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Alert, Typography } from '@mui/joy';

export function InlineError(props: { error: Error | React.JSX.Element | null | any, severity?: 'warning' | 'danger' | 'info', sx?: SxProps }) {
  const color = props.severity === 'info' ? 'primary' : props.severity || 'warning';
  return (
    <Alert variant='soft' color={color} sx={{ mt: 1, ...props.sx }}>
      <Typography level='body-sm' color={color}>
        {props.error?.message || props.error || 'Unknown error'}
      </Typography>
    </Alert>
  );
}
