import * as React from 'react';

import { Box, Chip, IconButton, Typography } from '@mui/joy';
import FormatPaintIcon from '@mui/icons-material/FormatPaint';

import { niceShadowKeyframes } from '../../call/Contacts';


export const DrawHeading = () =>
  <Box sx={{
    // my: 6,
    display: 'flex', alignItems: 'center',
    gap: 3,
  }}>
    <IconButton
      variant='soft' color='success'
      sx={{
        '--IconButton-size': { xs: '4.2rem', md: '5rem' },
        borderRadius: '50%',
        pointerEvents: 'none',
        backgroundColor: 'background.popup',
        animation: `${niceShadowKeyframes} 5s infinite`,
      }}>
      <FormatPaintIcon />
    </IconButton>

    <Box>
      <Typography level='title-lg'>
        Draw with AI
      </Typography>
      <Typography level='title-sm' sx={{ mt: 1 }}>
        Turn your ideas into images
      </Typography>
      <Chip variant='outlined' size='sm' sx={{ px: 1, py: 0.5, mt: 0.25, ml: -1, textWrap: 'wrap' }}>
        Multi-models, AI assisted
      </Chip>
    </Box>
  </Box>;