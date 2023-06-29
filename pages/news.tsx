import * as React from 'react';

import { Box, Typography, useTheme } from '@mui/joy';

import { AppLayout } from '~/common/layouts/AppLayout';
import { Brand } from '~/common/brand';


export default function NewsPage() {
  const theme = useTheme();

  return (
    <AppLayout suspendAutoModelsSetup>

      <Box sx={{
        background: theme.vars.palette.background.level2,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        flexGrow: 1,
        overflowY: 'auto',
        minHeight: 96,
        p: { xs: 1, sm: 2, md: 3 },
      }}>

        <Typography level='display2'>
          {/*{Brand.Title.Base} has been updated!*/}
          New updates!
        </Typography>

        aa


      </Box>

    </AppLayout>
  );
}