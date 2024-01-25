import * as React from 'react';
import { keyframes } from '@emotion/react';

import { Avatar, Box } from '@mui/joy';


const cssScaleKeyframes = keyframes`
    0% {
        transform: scale(1);
    }
    50% {
        transform: scale(1.2);
    }
    100% {
        transform: scale(1);
    }`;


export function CallAvatar(props: { symbol: string, imageUrl?: string, isRinging?: boolean, onClick: () => void }) {
  return (
    <Avatar
      onClick={props.onClick}
      src={props.imageUrl}
      sx={{
        '--Avatar-size': { xs: '10rem', md: '11.5rem' },
        backgroundColor: 'background.popup',
        boxShadow: !props.imageUrl ? 'sm' : null,
        fontSize: { xs: '6rem', md: '7rem' },
      }}
    >

      {/* As fallback, show the large Persona Symbol */}
      {!props.imageUrl && (
        <Box
          sx={{
            ...(props.isRinging
              ? { animation: `${cssScaleKeyframes} 1.4s ease-in-out infinite` }
              : {}),
          }}
        >
          {props.symbol}
        </Box>
      )}

    </Avatar>
  );
}