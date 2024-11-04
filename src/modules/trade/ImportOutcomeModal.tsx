import * as React from 'react';

import { Alert, Box, Divider, IconButton, List, ListItem, Tooltip, Typography } from '@mui/joy';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

import type { DConversation, DConversationId } from '~/common/stores/chat/chat.conversation';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { copyToClipboard } from '~/common/util/clipboardUtils';


type ConversationOutcome = {
  success: true;
  fileName: string;
  conversation: DConversation;
  importedConversationId?: DConversationId;
} | {
  success: false;
  fileName: string;
  error: string;
}


export interface ImportedOutcome {
  conversations: ConversationOutcome[];
  activateConversationId: DConversationId | null;
}


/**
 * Displays the result of an import operation as a modal dialog.
 */
export function ImportOutcomeModal(props: { outcome: ImportedOutcome, rawJson: string | null, onClose: () => void }) {
  const { conversations } = props.outcome;

  const successes = conversations.filter(c => c.success);
  const failures = conversations.filter(c => !c.success);
  const hasAnyResults = successes.length > 0 || failures.length > 0;
  const hasAnyFailures = failures.length > 0;

  const handleCopyRawJson = () => {
    if (props.rawJson)
      copyToClipboard(props.rawJson, 'ChatGPT JSON');
  };

  return (
    <GoodModal open title={hasAnyResults ? hasAnyFailures ? 'Import issues' : 'Import successful' : 'Import failed'} strongerTitle onClose={props.onClose}>

      <Divider />

      {successes.length >= 1 && <>
        <Alert variant='soft' color='success'>
          <Typography>
            Imported {successes.length} conversation{successes.length === 1 ? '' : 's'}.
          </Typography>
          {!!props.rawJson && (
            <Tooltip title='Copy JSON to clipboard'>
              <IconButton variant='outlined' onClick={handleCopyRawJson} sx={{ ml: 'auto' }}>
                <ContentCopyIcon />
              </IconButton>
            </Tooltip>
          )}
        </Alert>
        <Typography>
          The conversation{successes.length === 1 ? '' : 's'} can be found in the menu,
          and {successes.length === 1 ? 'it' : 'the last one'} is now active.
        </Typography>
      </>}

      {failures.length >= 1 && <Box>
        <Alert variant='soft' color='danger'>
          <Typography>
            Issues importing {failures.length} conversation{failures.length === 1 ? '' : 's'}:
          </Typography>
        </Alert>
        <List>
          {failures.map((f, idx) =>
            <ListItem variant='soft' color='warning' key={'fail-' + idx} sx={{ display: 'list-item' }}>
              <b>{f.fileName}</b>: {(f as any).error}
            </ListItem>,
          )}
        </List>
      </Box>}

    </GoodModal>
  );
}