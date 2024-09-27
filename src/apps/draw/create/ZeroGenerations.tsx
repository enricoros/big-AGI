import * as React from 'react';

import { Card, Typography } from '@mui/joy';


export function ZeroGenerations() {
  return (
    <Card variant='soft' sx={{
      maxWidth: 'max(50%, 320px)',
      mx: 'auto',
      mt: 'auto',
      mb: '6rem',
      backgroundColor: 'background.surface',
      borderRadius: 'lg',
      boxShadow: 'lg',
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
    }}>
      {/*<Typography level='h4'>*/}
      {/*  {Brand.Title.Base} Draw*/}
      {/*</Typography>*/}
      <Typography level='title-sm' sx={{ whiteSpace: 'balance' }}>
        Generate stunning images from text.
        Simply type in an image, drawing, or photo description, and the AI will bring your vision to life.
        {/*To get started enter your prompt and hit &quot;<b>Draw</b>&quot;.*/}
      </Typography>
    </Card>
  );
}