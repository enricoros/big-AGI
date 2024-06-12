import * as React from 'react';

import { Box, Card, Typography } from '@mui/joy';

import { Brand } from '~/common/app.config';


export function FallbackNoImages() {
  return (
    <Card variant='soft' sx={{
      maxWidth: 'max(50%, 320px)',
      mx: 'auto',
      mt: 'auto',
      mb: '6rem',
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
      boxShadow: 'lg',
    }}>
      {/*<Typography level='h4'>*/}
      {/*  {Brand.Title.Base} Draw*/}
      {/*</Typography>*/}
      <Typography level='body-md' sx={{ whiteSpace: 'balance' }}>
        Simply type in a description, and the AI will bring your vision to life.
        To get started enter your prompt and hit &quot;Draw&quot;!
      </Typography>
    </Card>
  );
}