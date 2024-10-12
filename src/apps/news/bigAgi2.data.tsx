import * as React from 'react';

import { Button, Card, CardContent, Grid, Typography } from '@mui/joy';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LaunchIcon from '@mui/icons-material/Launch';

import { Link } from '~/common/components/Link';


const bigAgi2SurveyUrl = 'https://y2rjg0zillz.typeform.com/to/ZSADpr5u?utm_source=gh-2&utm_medium=news&utm_campaign=ea2';

export const bigAgi2NewsCallout =
  <Card variant='solid' invertedColors>
    <CardContent sx={{ gap: 2 }}>
      <Typography level='title-lg'>
        Big-AGI 2.0 - In Development
      </Typography>
      <Typography level='body-sm'>
        We&apos;re building the next version of Big-AGI with your needs in mind. New features, better performance, enhanced AI interactions. Help us shape it.
      </Typography>
      <Grid container spacing={1}>
        <Grid xs={12} sm={7}>
          <Button
            fullWidth variant='soft' color='primary' endDecorator={<LaunchIcon />}
            component={Link} href={bigAgi2SurveyUrl} noLinkStyle target='_blank'
          >
            Apply for Early Access
          </Button>
        </Grid>
        <Grid xs={12} sm={5} sx={{ display: 'flex', flexAlign: 'center', justifyContent: 'center' }}>
          <Button
            fullWidth variant='outlined' color='primary' startDecorator={<AccessTimeIcon />}
            disabled
          >
            Coming Fall 2024
          </Button>
        </Grid>
      </Grid>
    </CardContent>
  </Card>;