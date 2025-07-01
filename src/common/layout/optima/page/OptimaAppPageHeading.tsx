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
  textClickable: {
    cursor: 'pointer',
    '&:hover': {
      textDecoration: 'underline',
    },
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
} as const;


export function OptimaAppPageHeading(props: {
  title: React.ReactNode;
  tagline?: React.ReactNode;
  accentedTagline?: boolean;
  startDecorator?: React.ReactNode;
  endDecorator?: React.ReactNode;
  noDivider?: boolean;
  noMarginBottom?: boolean;
  onClick?: (event: React.MouseEvent) => void;
}) {

  // external state
  const isMobile = useIsMobile();

  return (
    <Box mb={props.noMarginBottom ? undefined : 2.25}>
      {!!props.title && <Typography level={isMobile ? 'h3' : 'h2'} startDecorator={props.startDecorator} endDecorator={props.endDecorator} sx={_styles.title}>
        {props.onClick ? <Box component='span' sx={_styles.textClickable} onClick={props.onClick}>{props.title}</Box> : props.title}
      </Typography>}
      {!!props.tagline && <Typography level='body-sm' sx={props.accentedTagline ? _styles.accentedTagline : _styles.tagline}>
        {props.tagline}
      </Typography>}
      {!props.noDivider && <ListDivider sx={_styles.divisor} />}
    </Box>
  );
}