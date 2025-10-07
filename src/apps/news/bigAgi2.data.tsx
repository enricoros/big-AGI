import * as React from 'react';

import { Button, Card, CardContent, Grid, Typography } from '@mui/joy';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LaunchIcon from '@mui/icons-material/Launch';
import RocketLaunchRounded from '@mui/icons-material/RocketLaunchRounded';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';

import { Link } from '~/common/components/Link';
import { clientUtmSource } from '~/common/util/pwaUtils';


export const bigAgi2Url = 'https://app.big-agi.com' + clientUtmSource('upgrade');
const bigAgiSupport = 'https://form.typeform.com/to/nLf8gFmx?utm_source=big-agi-1&utm_medium=app&utm_campaign=support';


export const bigAgi2NewsCallout =
  <Card variant='solid' color='primary' invertedColors>
    <CardContent sx={{ gap: 2 }}>

      <Typography level='title-lg'>
        Big-AGI 2.0 ✨ - Now Live
      </Typography>

      <Typography level='title-sm' sx={{ lineHeight: 'xl' }}>
        Experience the <b>next generation of Big-AGI</b> with <b>Beam 2</b>, <b>Personas</b>, and <b>Cloud Sync</b> to never lose data.
      </Typography>

      <Grid container spacing={1}>
        <Grid xs={12} sm={7}>
          <Button
            size='lg'
            fullWidth variant='solid' color='neutral' endDecorator={<RocketLaunchRounded />}
            component={Link} href={bigAgi2Url} noLinkStyle target='_blank'
          >
            Big-AGI 2.0
          </Button>
        </Grid>

        <Grid xs={12} sm={5} sx={{ display: 'flex', flexAlign: 'center', justifyContent: 'center' }}>
          <Button
            fullWidth variant='soft' color='primary' endDecorator={<SupportAgentIcon />}
            component={Link} href={bigAgiSupport} noLinkStyle target='_blank'
            // disabled
          >
            Support
          </Button>
        </Grid>

      </Grid>
    </CardContent>
  </Card>;