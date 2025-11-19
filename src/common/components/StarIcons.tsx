import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import StarIcon from '@mui/icons-material/Star';


// configuration
const STAR_COLOR = '#fad857'; // gold/yellow
const STAR_COLOR_HOVER = '#f3c623';
export const STAR_EMOJI = '⭐';

const starIconStyles = {
  starred: {
    color: STAR_COLOR,
    fontSize: 'xl2'
  } as const,
  starredNoXl2: {
    color: STAR_COLOR,
  } as const,
  // unStarred: undefined,
} as const satisfies Record<string, SxProps | undefined>;


// Memoized star components for performance

export const Starred = React.memo(function Starred() {
  return <StarIcon sx={starIconStyles.starred} />;
});

export const StarredNoXL2 = React.memo(function StarredNoXL2() {
  return <StarIcon sx={starIconStyles.starredNoXl2} />;
});

const UnStarredNoXL2 = React.memo(function UnStarred() {
  return <StarBorderIcon />;
})

export const StarredState = React.memo(function StarredState({ isStarred }: { isStarred: boolean }) {
  return isStarred ? <Starred /> : <UnStarredNoXL2 />;
});

// have an unstyled that just returns StarIcon or StarBorderIcon and we can use with our own styles and props {...}
export const StarIconUnstyled = React.memo(function StarIconUnstyled({ isStarred }: { isStarred: boolean }) {
  return isStarred ? <StarIcon /> : <StarBorderIcon />;
});


// -- Interactive star toggle with aria-state-based styling --

export const starredToggleStyle = {
  transition: 'color 0.2s, font-size 0.2s, opacity 0.2s',
  ['& .agi-star']: {
    opacity: 0.4,
    fontSize: 'md',
  },
  ['& .agi-star:hover']: {
    opacity: 0.8,
  },
  ['& .agi-star[aria-checked="true"]']: {
    opacity: 1,
    color: STAR_COLOR,
    fontSize: 'xl2',
  },
  ['& .agi-star[aria-checked="true"]:hover']: {
    color: STAR_COLOR_HOVER,
  },
} as const satisfies SxProps;

export const StarredToggle = React.memo(function StarredToggle({ isStarred }: { isStarred: boolean }) {
  return isStarred
    ? <StarIcon aria-checked={true} className='agi-star' />
    : <StarBorderIcon aria-checked={false} className='agi-star' />;
});
