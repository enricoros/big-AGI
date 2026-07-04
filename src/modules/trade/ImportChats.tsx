import * as React from 'react';

import { Box, Button, Typography } from '@mui/joy';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';

import { Brand } from '~/common/app.config';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { KeyStroke } from '~/common/components/KeyStroke';
import { DConversationId } from '~/common/stores/chat/chat.conversation';

import { importConversationsFromFilesAtRest, openConversationsAtRestPicker } from './trade.client';

import { FlashRestore } from './BackupRestore';
import { ImportedOutcome, ImportOutcomeModal } from './ImportOutcomeModal';


export type ImportConfig = { dir: 'import' };


/**
 * Components and functionality to import conversations
 * Supports our own JSON/backup files
 */
export function ImportChats(props: { onConversationActivate: (conversationId: DConversationId) => void, onClose: () => void }) {

  // state
  const [importOutcome, setImportOutcome] = React.useState<ImportedOutcome | null>(null);


  const handleImportFromFiles = async () => {
    // restoreModelServices: this dialog is the deliberate restore surface, so backup files also bring their services (keys) back
    const outcome = await openConversationsAtRestPicker().then(files => importConversationsFromFilesAtRest(files, false, true));

    // activate the last (most recent) imported conversation
    if (outcome?.activateConversationId)
      props.onConversationActivate(outcome.activateConversationId);

    // show the outcome of the import
    setImportOutcome(outcome);
  };

  const handleImportOutcomeClosed = () => {
    setImportOutcome(null);
    props.onClose();
  };


  return <>

    <Box sx={{ display: 'grid', gap: 1, mx: 'auto' }}>

      <Typography level='body-sm'>
        Select where to <strong>import from</strong>:
      </Typography>

      <GoodTooltip title={<KeyStroke variant='solid' combo='Ctrl + O' />}>
        <Button
          variant='soft' endDecorator={<FileUploadOutlinedIcon />} sx={{ minWidth: 240, justifyContent: 'space-between' }}
          onClick={handleImportFromFiles}
        >
          {Brand.Title.Base} · JSON
        </Button>
      </GoodTooltip>

      {/* Restore from a backup file */}
      <FlashRestore unlockRestore={true} />

    </Box>

    {/* import outcome */}
    {!!importOutcome && <ImportOutcomeModal outcome={importOutcome} onClose={handleImportOutcomeClosed} />}

  </>;
}
