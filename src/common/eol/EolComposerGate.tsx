import * as React from 'react';

import { Box, Button, Card, CardContent, Chip, Typography } from '@mui/joy';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import { EOL_HOSTED_OFFLINE_TEXT_SHORT, eolComposerAllowThisSession, eolComposerSessionOverride, eolDaysRemaining, eolShouldBlockComposer, eolTrackEvent } from './eol.config';
import { EolMigrationModal } from './EolMigrationModal';


/**
 * Final-week escalation: on the hosted instance, in the last 7 days before the
 * shutdown, the chat Composer is replaced by this migration banner.
 *
 * The user can still opt to compose for the rest of the session ('Compose anyway'),
 * so nobody is hard-locked out before the actual offline date.
 */
export function EolComposerGate(props: { children: React.ReactNode }) {

  // state
  const [mounted, setMounted] = React.useState(false); // client-only: depends on hostname, time, and sessionStorage
  const [sessionOverride, setSessionOverride] = React.useState(false);
  const [wizardOpen, setWizardOpen] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    setSessionOverride(eolComposerSessionOverride());
  }, []);

  // derived
  const blocked = mounted && !sessionOverride && eolShouldBlockComposer();
  const daysLeft = eolDaysRemaining();

  // analytics: count blocked sessions
  React.useEffect(() => {
    if (blocked)
      eolTrackEvent('eol_composer_blocked', 'composer');
  }, [blocked]);


  const handleOpenWizard = React.useCallback(() => {
    eolTrackEvent('eol_wizard_open', 'composer');
    setWizardOpen(true);
  }, []);

  const handleComposeAnyway = React.useCallback(() => {
    eolTrackEvent('eol_snooze', 'composer');
    eolComposerAllowThisSession();
    setSessionOverride(true);
  }, []);


  if (!blocked)
    return <>{props.children}</>;

  return <>

    {/* In place of the Composer */}
    <Box sx={{ p: { xs: 1, md: 2 }, pt: 0 }}>
      <Card variant='solid' color='warning' invertedColors>
        <CardContent sx={{ gap: 1 }}>

          <Typography level='title-md' startDecorator={<WarningRoundedIcon />}>
            Big-AGI v1 goes offline {EOL_HOSTED_OFFLINE_TEXT_SHORT}
            {daysLeft > 0 && <Chip size='sm' variant='soft' sx={{ ml: 1 }}>{daysLeft} day{daysLeft === 1 ? '' : 's'} left</Chip>}
          </Typography>

          <Typography level='body-sm'>
            This site will then automatically redirect to the new Big-AGI.
            Move your chats now - it takes two minutes, and your API keys come along.
          </Typography>

          <Box sx={{ mt: 1, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant='solid' color='neutral' onClick={handleOpenWizard} sx={{ minWidth: 160 }}>
              Migrate now
            </Button>
            <Button variant='plain' size='sm' onClick={handleComposeAnyway}>
              Compose anyway (this session)
            </Button>
          </Box>

        </CardContent>
      </Card>
    </Box>

    {/* Migration Wizard */}
    {wizardOpen && (
      <EolMigrationModal
        origin='composer'
        onClose={() => setWizardOpen(false)}
      />
    )}

  </>;
}
