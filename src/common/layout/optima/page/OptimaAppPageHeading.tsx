import * as React from 'react';

import { Box, ListDivider, Typography } from '@mui/joy';

import { useIsMobile } from '~/common/components/useMatchMedia';


const _styles = {
  root: {
    mb: 2.25,
  },
  title: {
    overflow: 'hidden',
    textAlign: 'start',
  },
  textClickable: {
    cursor: 'pointer',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  taglineAccented: {
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
  taglineAccented?: boolean;
  startDecorator?: React.ReactNode;
  endDecorator?: React.ReactNode;
  disabled?: boolean;
  noDivider?: boolean;
  noMarginBottom?: boolean;
  onClick?: (event: React.MouseEvent) => void;
}) {

  // external state
  const isMobile = useIsMobile();

  return (
    <Box mb={props.noMarginBottom ? undefined : 2.25} sx={{ overflow: 'hidden', display: 'grid' }}>
      {!!props.title && <Typography level={isMobile ? 'h3' : 'h2'} startDecorator={props.startDecorator} endDecorator={props.endDecorator} textColor={props.disabled ? 'neutral.plainDisabledColor' : undefined} sx={_styles.title}>
        {props.onClick
          ? <Box component='span' sx={_styles.textClickable} onClick={props.onClick} className='agi-ellipsize'>{props.title}</Box>
          : <span className='agi-ellipsize'>{props.title}</span>
        }
      </Typography>}
      {!!props.tagline && <Typography level='body-sm' sx={props.taglineAccented ? _styles.taglineAccented : _styles.tagline}>
        {props.tagline}
      </Typography>}
      {!props.noDivider && <ListDivider sx={_styles.divisor} />}
    </Box>
  );
}