import * as React from 'react';

import { Box, ListDivider, Typography } from '@mui/joy';

import { useIsMobile } from '~/common/components/useMatchMedia';


const _styles = {
  root: {
    mb: 2.25,
  },
  title: {
    textAlign: 'start',
  },
  accentedTagline: {
    textAlign: 'start',
    mt: 0.75,
  },
  tagline: {
    color: 'text.secondary',
    textAlign: 'start',
    mt: 0.75,
  },
  divisor: {
    mt: 2.25,
  },
};


export function OptimaAppPageHeading(props: {
  title: React.ReactNode;
  tagline?: React.ReactNode;
  accentedTagline?: boolean;
  startDecorator?: React.ReactNode;
  endDecorator?: React.ReactNode;
  noDivider?: boolean;
}) {

  // external state
  const isMobile = useIsMobile();

  return (
    <Box mb={2.25}>
      {!!props.title && <Typography level={isMobile ? 'h3' : 'h2'} startDecorator={props.startDecorator} endDecorator={props.endDecorator} sx={_styles.title}>
        {props.title}
      </Typography>}
      {!!props.tagline && <Typography level='body-sm' sx={props.accentedTagline ? _styles.accentedTagline : _styles.tagline}>
        {props.tagline}
      </Typography>}
      {!props.noDivider && <ListDivider sx={_styles.divisor} />}
    </Box>
  );
}