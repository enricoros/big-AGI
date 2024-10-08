import { SignInButton } from '@clerk/nextjs';
import FavoriteBorder from '@mui/icons-material/FavoriteBorder';
import Box from '@mui/joy/Box';
import Button from '@mui/joy/Button';
import dynamic from 'next/dynamic';
import React from 'react';

const DynamicConfetti = dynamic(() => import('./confetti/ConfettiWithProvider'), {
  ssr: false,
  loading: () => <p>Loading...</p>,
});

export function LandingPageUnAuthed(props: { children?: React.ReactNode }) {
  return (
    <>
      <Box
        sx={{
          display: 'flex',
          justifContent: 'center',
          alignItems: 'center',
          height: '100vh',
          width: '100vw',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column',
            height: '100vh',
            width: '100vw',
          }}
        >
          <DynamicConfetti />
          <SignInButton>
            <Button
              sx={{
                margin: 'auto',
                backgroundColor: 'greenyellow',
                color: 'black',
                height: '3rem',
                width: '10rem',
              }}
              variant="solid"
              // color="seconary"
              startDecorator={<FavoriteBorder />}
              endDecorator={<FavoriteBorder />}
            >
              &nbsp;Sign In&nbsp;
            </Button>
          </SignInButton>
        </Box>
      </Box>
    </>
  );
}
