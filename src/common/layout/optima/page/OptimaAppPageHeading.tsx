import * as React from 'react';

import { Box, ListDivider, Typography } from '@mui/joy';


export function OptimaAppPageHeading(props: {
  title: React.ReactNode;
  tagline?: React.ReactNode;
  accentedTagline?: boolean;
  startDecorator?: React.ReactNode;
  endDecorator?: React.ReactNode;
  noDivider?: boolean;
}) {
  return (
    <Box mb={2.25}>
      {!!props.title && <Typography level='h2' sx={{ textAlign: 'start' }} startDecorator={props.startDecorator} endDecorator={props.endDecorator}>
        {props.title}
      </Typography>}
      {!!props.tagline && <Typography level='body-sm' sx={{ color: !props.accentedTagline ? undefined : 'text.secondary', textAlign: 'start', mt: 0.75 }}>
        {props.tagline}
      </Typography>}
      {!props.noDivider && <ListDivider sx={{ mt: 2.25 }} />}
    </Box>
  );
}