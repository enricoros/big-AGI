import { Box, ListDivider, Typography } from '@mui/joy';
import * as React from 'react';

export function OptimaAppPageHeading(props: {
  title: React.ReactNode;
  tagline: React.ReactNode;
  accentedTagline?: boolean;
  startDecorator?: React.ReactNode;
}) {
  return (
    <Box>
      {!!props.title && <Typography level='h2' sx={{ textAlign: 'start' }} startDecorator={props.startDecorator}>
        {props.title}
      </Typography>}
      {!!props.tagline && <Typography level='body-sm' sx={{ color: !props.accentedTagline ? undefined : 'text.secondary', textAlign: 'start', mt: 0.75 }}>
        {props.tagline}
      </Typography>}
      <ListDivider sx={{ my: 2.25 }} />
    </Box>
  );
}