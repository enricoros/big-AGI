import * as React from 'react';

import { Button, Card, CardContent, Grid, Typography } from '@mui/joy';
import LaunchIcon from '@mui/icons-material/Launch';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import { EOL_HOSTED_OFFLINE_TEXT, eolIsHostedInstance, eolSupportUrl, eolTrackEvent, eolUpgradeUrl } from '~/common/eol/eol.config';
import { EolMigrationModal } from '~/common/eol/EolMigrationModal';


// all v2-bound CTAs carry `utm_campaign=eol-v1`, which the new app keys on
export const bigAgi2Url = eolUpgradeUrl;


/**
 * The V1 End-of-Life callout, shown at the top of the News page.
 * Announces the shutdown and opens the migration wizard.
 */
export function EolNewsCallout() {

  // state
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false); // client-only copy (hostname-dependent)

  React.useEffect(() => setMounted(true), []);

  const isHosted = mounted && eolIsHostedInstance();

  const handleOpenWizard = React.useCallback(() => {
    eolTrackEvent('eol_wizard_open', 'news');
    setWizardOpen(true);
  }, []);

  return <>

    <Card variant='solid' color='warning' invertedColors>
      <CardContent sx={{ gap: 2 }}>

        <Typography level='title-lg' startDecorator={<WarningRoundedIcon />}>
          Big-AGI v1 - End of Life
        </Typography>

        <Typography level='title-sm' sx={{ lineHeight: 'xl' }}>
          {isHosted ? <>
            This service goes <b>offline on {EOL_HOSTED_OFFLINE_TEXT}</b>, then this site
            automatically redirects to the new Big-AGI.{' '}
          </> : <>
            Big-AGI v1 no longer receives updates or new models.{' '}
          </>}
          Your chats live only in this browser: <b>export them now</b> and continue on the new{' '}
          <b>Big-AGI</b> - latest models, Beam 2, Personas, and Cloud Backup.
        </Typography>

        <Grid container spacing={1}>
          <Grid xs={12} sm={7}>
            <Button
              size='lg'
              fullWidth variant='solid' color='neutral' endDecorator={<LaunchIcon />}
              onClick={handleOpenWizard}
            >
              Migrate now
            </Button>
          </Grid>

          <Grid xs={12} sm={5} sx={{ display: 'flex', flexAlign: 'center', justifyContent: 'center' }}>
            <Button
              fullWidth variant='soft' endDecorator={<SupportAgentIcon />}
              component='a' href={eolSupportUrl} target='_blank'
            >
              Support
            </Button>
          </Grid>

        </Grid>
      </CardContent>
    </Card>

    {/* Migration Wizard */}
    {wizardOpen && (
      <EolMigrationModal
        origin='news'
        onClose={() => setWizardOpen(false)}
      />
    )}

  </>;
}
