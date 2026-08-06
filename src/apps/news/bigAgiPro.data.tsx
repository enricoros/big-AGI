import * as React from 'react';

import { Button, Card, CardContent, Grid, Typography } from '@mui/joy';
import RocketLaunchRounded from '@mui/icons-material/RocketLaunchRounded';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';

import { Link } from '~/common/components/Link';
import { clientUtmSource } from '~/common/util/pwaUtils';


export const bigAgiProUrl = 'https://big-agi.com' + clientUtmSource('upgrade');

export function BigAgiProNewsCallout() {

  const bigAgiSupportUrl = 'https://form.typeform.com/to/nLf8gFmx?utm_source=big-agi-1&utm_medium=app&utm_campaign=support';

  return (
    <Card variant='solid' color='primary' invertedColors>
      <CardContent sx={{ gap: 2 }}>
        <Typography level='title-lg'>Big-AGI Pro ✨ - Now Live</Typography>

        <Typography level='title-sm' sx={{ lineHeight: 'xl' }}>
          Experience the <b>next generation of Big-AGI</b> with <b>Beam 2</b>, <b>Personas</b>, and <b>Cloud Sync</b> to never lose data.
        </Typography>

        <Grid container spacing={1}>
          <Grid xs={12} sm={7}>
            <Button
              size='lg'
              fullWidth
              variant='solid'
              color='neutral'
              endDecorator={<RocketLaunchRounded />}
              component={Link}
              href={bigAgiProUrl}
              noLinkStyle
              target='_blank'
            >
              Big-AGI Pro
            </Button>
          </Grid>

          <Grid xs={12} sm={5} sx={{ display: 'flex', flexAlign: 'center', justifyContent: 'center' }}>
            <Button
              fullWidth
              variant='soft'
              color='primary'
              endDecorator={<SupportAgentIcon />}
              component={Link}
              href={bigAgiSupportUrl}
              noLinkStyle
              target='_blank'
              disabled
            >
              Support
            </Button>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}