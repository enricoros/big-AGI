import * as React from 'react';


import { Box, Button, Divider, Typography } from '@mui/joy';

import { Brand } from '~/common/brand';
import { GoodModal } from '~/common/components/GoodModal';
import { useChatStore } from '~/common/state/store-chats';

import { ImportedOutcome, ImportOutcomeModal } from './ImportOutcomeModal';
import { restoreConversationFromJson } from '../exportImport';


export type ImportExportMode = 'import' | 'export';


export function ImportExportModal(props: { mode: ImportExportMode, onClose: () => void }) {

  // state
  const importFilesInputRef = React.useRef<HTMLInputElement>(null);
  const [conversationImportOutcome, setConversationImportOutcome] = React.useState<ImportedOutcome | null>(null);


  // imports

  const handleImportFromFiles = () => importFilesInputRef.current?.click();

  const handleImportLoadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target?.files;
    if (!files || files.length < 1)
      return;

    // restore conversations from the selected files
    const outcomes: ImportedOutcome = { conversations: [] };
    for (const file of files) {
      const fileName = file.name || 'unknown file';
      try {
        const conversation = restoreConversationFromJson(await file.text());
        if (conversation) {
          useChatStore.getState().importConversation(conversation);
          outcomes.conversations.push({ fileName, success: true, conversationId: conversation.id });
        } else {
          const fileDesc = `(${file.type}) ${file.size.toLocaleString()} bytes`;
          outcomes.conversations.push({ fileName, success: false, error: `Invalid file: ${fileDesc}` });
        }
      } catch (error) {
        console.error(error);
        outcomes.conversations.push({ fileName, success: false, error: (error as any)?.message || error?.toString() || 'unknown error' });
      }
    }

    // show the outcome of the import
    setConversationImportOutcome(outcomes);

    // this is needed to allow the same file to be selected again
    e.target.value = '';
  };

  const handleImportOutcomeClosed = () => {
    setConversationImportOutcome(null);
    props.onClose();
  };


  // ui
  const showImport = props.mode === 'import';
  const showExport = props.mode === 'export';


  return <>

    {/* trigger for the local-file-load */}
    {showImport && <input type='file' multiple hidden accept='.json' ref={importFilesInputRef} onChange={handleImportLoadFiles} />}

    <GoodModal title={<><b>{showImport ? 'Import ' : showExport ? 'Export ' : ''}</b> conversations</>} open onClose={props.onClose}>

      <Divider />

      {/* Import Buttons */}
      {showImport && <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>

        <Typography level='body-sm'>
          Select where to import from
        </Typography>

        <Button variant='soft' size='md' onClick={handleImportFromFiles} sx={{ minWidth: 260 }}>
          {Brand.Title.Base} JSON Files
        </Button>

        <Button variant='soft' size='md' onClick={() => null} sx={{ minWidth: 260 }}>
          OpenAI Shared Chats
        </Button>

      </Box>}

      <Divider />

    </GoodModal>

    {!!conversationImportOutcome && <ImportOutcomeModal outcome={conversationImportOutcome} onClose={handleImportOutcomeClosed} />}
  </>;
}