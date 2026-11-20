import * as React from 'react';

import { Button, Chip, IconButton, Sheet, Typography } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';

import { tradeFilesPick } from '~/modules/trade/trade.files';

import { launchAppChat } from '~/common/app.routes';
import { themeZIndexPageBar } from '~/common/app.theme';
import { uiSetDismissed, useUIIsDismissed } from '~/common/stores/store-ui';

import { FROM_V1_DISMISS_KEY, fromV1ArrivedRecently, fromV1DetectArrival } from './from-v1';


const TradeModalLazy = React.lazy(() => import('~/modules/trade/TradeModal').then(module => ({ default: module.TradeModal })));


/**
 * Welcome banner for users arriving from Big-AGI V1 (EOL migration, `utm_campaign=eol-v1`).
 * Offers the import of the V1 backup file - chats and folders, and the API keys once ticked in the import dialog.
 * Hidden once dismissed, or after a successful import.
 */
export function FromV1ImportBanner() {

  // state
  const [arrived, setArrived] = React.useState(false);
  const [files, setFiles] = React.useState<File[] | null>(null);
  const importedRef = React.useRef(false);

  // external state
  const dismissed = useUIIsDismissed(FROM_V1_DISMISS_KEY);

  // detect the arrival on mount (also parses the utm params of this very page load)
  React.useEffect(() => {
    fromV1DetectArrival();
    setArrived(fromV1ArrivedRecently());
  }, []);


  const handleImport = React.useCallback(async () => {
    const picked = await tradeFilesPick();
    if (picked?.length)
      setFiles(picked);
  }, []);

  const handleImportClose = React.useCallback(() => {
    setFiles(null);
    // mission accomplished - retire the banner, once the import dialog is gone
    if (importedRef.current)
      uiSetDismissed(FROM_V1_DISMISS_KEY);
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
        <strong style={{ color: 'var(--joy-palette-text-primary)' }}>Coming from Big-AGI v1?</strong> Import your backup - chats and folders come along, and your API keys if you tick them.
      </Typography>

      {/* CTA */}
      <Button
        size='sm'
        variant='soft'
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

      {/* The import dialog: shows what the backup holds, before anything is written */}
      {!!files && (
        <React.Suspense fallback={null}>
          <TradeModalLazy
            config={{ dir: 'import', files }}
            onConversationActivate={conversationId => void launchAppChat(conversationId)}
            onImported={() => importedRef.current = true}
            onClose={handleImportClose}
          />
        </React.Suspense>
      )}

    </Sheet>
  );
}
