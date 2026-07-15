import * as React from 'react';

import { Button, Chip, IconButton, Sheet, Typography } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';

import { importConversationsFromFilesAtRest, openConversationsAtRestPicker } from '~/modules/trade/trade.client';

import { addSnackbar } from '~/common/components/snackbar/useSnackbarsStore';
import { launchAppChat } from '~/common/app.routes';
import { themeZIndexPageBar } from '~/common/app.theme';
import { uiSetDismissed, useUIIsDismissed } from '~/common/stores/store-ui';

import { FROM_V1_DISMISS_KEY, fromV1ArrivedRecently, fromV1DetectArrival } from './from-v1';


/**
 * Welcome banner for users arriving from Big-AGI V1 (EOL migration, `utm_campaign=eol-v1`).
 * Offers a one-click import of the V1 backup file - chats, folders, and API keys.
 * Hidden once dismissed, or after a successful import.
 */
export function FromV1ImportBanner() {

  // state
  const [arrived, setArrived] = React.useState(false);
  const [importing, setImporting] = React.useState(false);

  // external state
  const dismissed = useUIIsDismissed(FROM_V1_DISMISS_KEY);

  // detect the arrival on mount (also parses the utm params of this very page load)
  React.useEffect(() => {
    fromV1DetectArrival();
    setArrived(fromV1ArrivedRecently());
  }, []);


  const handleImport = React.useCallback(async () => {
    const files = await openConversationsAtRestPicker();
    if (!files?.length) return;
    setImporting(true);
    try {
      // restoreModelServices: deliberate migration surface - bring the V1 API keys along
      const outcome = await importConversationsFromFilesAtRest(files, false, true);
      const okCount = outcome.conversations.filter(c => c.success).length;
      const failCount = outcome.conversations.length - okCount;
      if (okCount > 0) {
        addSnackbar({ key: 'from-v1-import', message: `Imported ${okCount} chat${okCount === 1 ? '' : 's'} from Big-AGI v1${failCount ? ` (${failCount} skipped)` : ''}.`, type: 'success' });
        uiSetDismissed(FROM_V1_DISMISS_KEY); // mission accomplished - retire the banner
        if (outcome.activateConversationId)
          await launchAppChat(outcome.activateConversationId);
      } else {
        addSnackbar({ key: 'from-v1-import', message: 'Could not import that file - use the backup downloaded from Big-AGI v1.', type: 'issue' });
      }
    } finally {
      setImporting(false);
    }
  }, []);

  const handleDismiss = React.useCallback(() => {
    uiSetDismissed(FROM_V1_DISMISS_KEY);
  }, []);


  if (!arrived || dismissed) return null;

  return (
    <Sheet
      color='primary'
      variant='solid'
      invertedColors
      sx={{
        zIndex: themeZIndexPageBar,
        py: 1,
        pl: 2,
        pr: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: { xs: 1.5, sm: 2 },
        flexWrap: 'wrap',
      }}
    >

      {/* V1 badge */}
      <Chip
        variant='solid'
        size='sm'
        sx={{
          fontWeight: 'xl',
          letterSpacing: 1,
          px: 1,
        }}
      >
        V1
      </Chip>

      {/* Message */}
      <Typography level='body-sm' sx={{ fontWeight: 500 }}>
        <strong style={{ color: 'var(--joy-palette-text-primary)' }}>Coming from Big-AGI v1?</strong> Import your backup - chats, folders and API keys come along.
      </Typography>

      {/* CTA */}
      <Button
        size='sm'
        variant='soft'
        loading={importing}
        onClick={handleImport}
        endDecorator={<FileUploadOutlinedIcon />}
        sx={{ minHeight: 'auto', py: 0.5, px: 1.5, minWidth: 104 }}
      >
        Import v1 backup
      </Button>

      {/* Dismiss */}
      <IconButton
        size='sm'
        onClick={handleDismiss}
        sx={{ ml: { xs: 'auto', sm: 0 } }}
        aria-label='Dismiss'
      >
        <CloseRoundedIcon />
      </IconButton>

    </Sheet>
  );
}
