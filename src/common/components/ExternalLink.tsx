import * as React from 'react';

import type { ColorPaletteProp, SxProps, TypographySystem } from '@mui/joy/styles/types';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import LaunchIcon from '@mui/icons-material/Launch';

import { Link } from './Link';


const wowStyle: SxProps = {
  textDecoration: 'underline',
  textDecorationThickness: '0.4em',
  textDecorationColor: 'rgba(var(--joy-palette-primary-lightChannel) / 1)',
  // textDecorationColor: 'rgba(0 255 0 / 0.5)',
  textDecorationSkipInk: 'none',
  // textUnderlineOffset: '-0.5em',
};


export function ExternalLink(props: {
  href: string,
  color?: ColorPaletteProp,
  level?: keyof TypographySystem | 'inherit',
  highlight?: boolean,
  icon?: 'issue' | 'public-docs',
  children: React.ReactNode,
}) {
  return (
    <Link level={props.level} color={props.color} href={props.href} target='_blank' sx={props.highlight ? wowStyle : undefined}>
      {props.children} {(props.icon === 'issue' || props.icon === 'public-docs')
      ? <AutoStoriesOutlinedIcon sx={{ mx: 0.5, fontSize: 16 }} />
      : <LaunchIcon sx={{ mx: 0.5, fontSize: 16 }} />
    }
    </Link>
  );
}