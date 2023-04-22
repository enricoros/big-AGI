import * as React from 'react';

import { Box, Button, Divider, List, ListItem, Modal, ModalDialog, Typography } from '@mui/joy';


export interface ImportedOutcome {
  conversations: {
    fileName: string;
    success: boolean;
    conversationId?: string;
    error?: string;
  }[];
}


/**
 * Displays the result of an import operation as a modal dialog.
 *
 * Import operations supported:
 *  - JSON Chat
 */
export function ImportedModal(props: { open: boolean, outcome: ImportedOutcome, onClose: () => void, }) {
  const { conversations } = props.outcome;

  const successes = conversations.filter(c => c.success);
  const failures = conversations.filter(c => !c.success);
  const hasAnyResults = successes.length > 0 || failures.length > 0;
  const hasAnyFailures = failures.length > 0;

  return (
    <Modal open={props.open} onClose={props.onClose}>
      <ModalDialog variant='outlined' color='neutral' sx={{ maxWidth: '100vw' }}>

        <Typography level='h5'>
          {hasAnyResults ? hasAnyFailures ? 'Import issues' : 'Import successful' : 'Import failed'}
        </Typography>

        <Divider sx={{ my: 2 }} />

        {successes.length >= 1 && <>
          <Typography>
            Imported {successes.length} conversation{successes.length === 1 ? '' : 's'}.
          </Typography>
          <Typography>
            {successes.length === 1 ? 'It' : 'They'} can be found in the Pages menu. Opening {successes.length === 1 ? 'it' : 'the last one'}.
          </Typography>
        </>}

        {failures.length >= 1 && <>
          <Typography variant='soft' color='danger'>
            Issues importing {failures.length} conversation{failures.length === 1 ? '' : 's'}:
          </Typography>
          <List>
            {failures.map((f, idx) =>
              <ListItem color='warning' key={'fail-' + idx}>{f.fileName}: {f.error}</ListItem>,
            )}
          </List>
        </>}

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 2 }}>
          <Button variant='soft' color='neutral' onClick={props.onClose}>
            Close
          </Button>
        </Box>
      </ModalDialog>
    </Modal>
  );
}