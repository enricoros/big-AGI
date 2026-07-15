import * as React from 'react';

import { Box, Button, Card, CardContent, IconButton, Typography } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import { EOL_HOSTED_OFFLINE_TEXT_SHORT, eolCanSnooze, eolDaysRemaining, eolIsHostedInstance, eolIsSnoozed, eolSnooze, eolTrackEvent } from '~/common/eol/eol.config';
import { EolMigrationModal } from '~/common/eol/EolMigrationModal';


/**
 * V1 End-of-Life notice, shown at the bottom of the Chat Drawer.
 *
 * Replaces the former 'Big-AGI 2.0 is Live' callout: this one is about the v1
 * shutdown (hosted goes offline on Aug 31, 2026) and opens the migration wizard.
 * Snoozable for 7 days at a time, permanent in the final week.
 */
export function ChatDrawerEolNotice() {

  // state
  const [mounted, setMounted] = React.useState(false); // client-only render: copy depends on hostname and localStorage
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [snoozed, setSnoozed] = React.useState(() => eolIsSnoozed());

  // derived - note: read once per mount, which is fine for day-scale timers
  const isHosted = eolIsHostedInstance();
  const daysLeft = eolDaysRemaining();
  const canSnooze = eolCanSnooze();

  React.useEffect(() => setMounted(true), []);

  // analytics: count how many users see this
  React.useEffect(() => {
    if (mounted && !snoozed)
      eolTrackEvent('eol_notice_shown', 'drawer');
  }, [mounted, snoozed]);


  const handleOpenWizard = React.useCallback(() => {
    eolTrackEvent('eol_wizard_open', 'drawer');
    setWizardOpen(true);
  }, []);

  const handleSnooze = React.useCallback(() => {
    eolTrackEvent('eol_snooze', 'drawer');
    eolSnooze();
    setSnoozed(true);
  }, []);


  if (!mounted || snoozed) return null;

  return <>

    {/* EOL Notice */}
    <Box sx={{ p: 2 }}>
      <Card variant='soft' color='warning' size='sm'>
        <CardContent sx={{ gap: 1, position: 'relative' }}>

          {/* Snooze 'x' - not available in the final week */}
          {canSnooze && (
            <IconButton
              aria-label='Remind me later'
              size='sm'
              color='warning'
              onClick={handleSnooze}
              sx={{ position: 'absolute', top: -6, right: -8 }}
            >
              <ClearIcon sx={{ fontSize: 'md' }} />
            </IconButton>
          )}

          <Typography level='title-sm' startDecorator={<WarningRoundedIcon />} sx={{ color: 'inherit', pr: canSnooze ? 3 : 0 }}>
            {isHosted ? `v1 goes offline ${EOL_HOSTED_OFFLINE_TEXT_SHORT}` : 'v1 is End of Life'}
          </Typography>

          <Typography level='body-xs' sx={{ color: 'inherit', mb: 0.5 }}>
            {isHosted
              ? <>{daysLeft} day{daysLeft === 1 ? '' : 's'} left to move your chats to the new Big-AGI.</>
              : <>No more updates or new models. Move your chats to the new Big-AGI.</>}
          </Typography>

          <Button
            fullWidth
            size='sm'
            variant='solid'
            color='warning'
            onClick={handleOpenWizard}
          >
            Migrate now
          </Button>

        </CardContent>
      </Card>
    </Box>

    {/* Migration Wizard */}
    {wizardOpen && (
      <EolMigrationModal
        origin='drawer'
        onClose={() => setWizardOpen(false)}
      />
    )}

  </>;
}
