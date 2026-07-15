import * as React from 'react';

import { Box, Button, Chip, Typography } from '@mui/joy';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import LaunchIcon from '@mui/icons-material/Launch';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import { downloadAllConversationsJson } from '~/modules/trade/trade.client';

import { GoodModal } from '~/common/components/GoodModal';
import { Link } from '~/common/components/Link';
import { addSnackbar } from '~/common/components/useSnackbarsStore';

import { EOL_HOSTED_OFFLINE_TEXT, eolCanSnooze, eolDaysRemaining, eolIsHostedInstance, eolSnooze, eolSupportUrl, eolTrackEvent, eolUpgradeUrl } from './eol.config';


const _styles = {
  step: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 1.5,
  },
  stepNumber: {
    flexShrink: 0,
    width: '1.75rem',
    height: '1.75rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    backgroundColor: 'primary.softBg',
    color: 'primary.softColor',
    fontWeight: 'lg',
    fontSize: 'sm',
  },
  stepBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    pt: 0.25,
    minWidth: 0,
  },
} as const;


/**
 * The V1 End-of-Life migration wizard: guides users to export their data
 * and continue on the new Big-AGI (which imports v1 files as-is).
 *
 * Shown from the Chat Drawer EOL notice and from the News page.
 */
export function EolMigrationModal(props: {
  origin: string; // for analytics: 'drawer' | 'news' | ...
  onClose: () => void;
}) {

  // state
  const [exported, setExported] = React.useState(false);

  // derived
  const isHosted = eolIsHostedInstance();
  const daysLeft = eolDaysRemaining();
  const canSnooze = eolCanSnooze();


  const handleExportAll = React.useCallback(() => {
    eolTrackEvent('eol_export', props.origin);
    downloadAllConversationsJson()
      .then(() => {
        setExported(true);
        addSnackbar({ key: 'eol-export-done', message: 'Backup saved - import this file in the new Big-AGI.', type: 'success' });
      })
      .catch(() => {
        // user cancelled the file dialog - nothing to do
      });
  }, [props.origin]);

  const handleOpenBigAgi2 = React.useCallback(() => {
    eolTrackEvent('eol_open_v2', props.origin);
  }, [props.origin]);

  const handleSnooze = React.useCallback(() => {
    eolTrackEvent('eol_snooze', props.origin);
    eolSnooze();
    props.onClose();
  }, [props]);


  return (
    <GoodModal
      open
      onClose={props.onClose}
      strongerTitle
      title={<>
        <WarningRoundedIcon sx={{ color: 'warning.solidBg', mr: 1, mb: -0.5 }} />
        Big-AGI v1 has reached End of Life
      </>}
      startButton={canSnooze
        ? <Button variant='plain' color='neutral' onClick={handleSnooze}>Remind me later</Button>
        : undefined
      }
    >

      {/* Why */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {isHosted ? (
          <Typography level='body-md'>
            This service will go <b>offline on {EOL_HOSTED_OFFLINE_TEXT}</b>{daysLeft > 0 && <Chip size='sm' color='warning' variant='soft' sx={{ ml: 1 }}>{daysLeft} days left</Chip>}.
            Big-AGI continues at <Link href={eolUpgradeUrl} target='_blank'>big-agi.com</Link> with
            the latest models, Beam 2, Personas, and Cloud Backup.
          </Typography>
        ) : (
          <Typography level='body-md'>
            Big-AGI v1 no longer receives updates, security fixes, or new models.
            Big-AGI continues at <Link href={eolUpgradeUrl} target='_blank'>big-agi.com</Link> with
            the latest models, Beam 2, Personas, and Cloud Backup.
          </Typography>
        )}
        <Typography level='body-md'>
          Your chats live <b>only in this browser</b>. Take them with you - it takes two minutes:
        </Typography>
      </Box>

      {/* Steps */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, my: 1 }}>

        {/* 1. Export */}
        <Box sx={_styles.step}>
          <Box sx={_styles.stepNumber}>{exported ? <CheckRoundedIcon fontSize='small' /> : '1'}</Box>
          <Box sx={_styles.stepBody}>
            <Typography level='title-sm'>Download your data</Typography>
            <Typography level='body-sm'>All chats, folders, and model settings, in a single file.</Typography>
            <Button
              variant={exported ? 'soft' : 'solid'}
              color='primary'
              onClick={handleExportAll}
              endDecorator={<FileDownloadOutlinedIcon />}
              sx={{ alignSelf: 'flex-start' }}
            >
              {exported ? 'Downloaded - download again' : 'Download backup'}
            </Button>
          </Box>
        </Box>

        {/* 2. Open the new app */}
        <Box sx={_styles.step}>
          <Box sx={_styles.stepNumber}>2</Box>
          <Box sx={_styles.stepBody}>
            <Typography level='title-sm'>Open the new Big-AGI</Typography>
            <Button
              variant='solid'
              color='primary'
              component={Link}
              href={eolUpgradeUrl}
              noLinkStyle
              target='_blank'
              onClick={handleOpenBigAgi2}
              endDecorator={<LaunchIcon />}
              sx={{ alignSelf: 'flex-start' }}
            >
              Open big-agi.com
            </Button>
          </Box>
        </Box>

        {/* 3. Import */}
        <Box sx={_styles.step}>
          <Box sx={_styles.stepNumber}>3</Box>
          <Box sx={_styles.stepBody}>
            <Typography level='title-sm'>Import</Typography>
            <Typography level='body-sm'>
              Drag the downloaded file into the new app, or use <b>Import</b> in the chats menu
              - which also restores your API keys.
            </Typography>
          </Box>
        </Box>

      </Box>

      {/* Footer */}
      <Typography level='body-xs' sx={{ textAlign: 'center', color: 'text.tertiary' }}>
        Questions or issues? <Link href={eolSupportUrl} target='_blank'>Contact support</Link>.
      </Typography>

    </GoodModal>
  );
}
