/**
 * Confirmation step for data import
 * Shows preview of what will be imported with warnings
 */

import * as React from 'react';
import { Alert, Box, Button, Divider, List, ListItem, Typography } from '@mui/joy';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';


interface ImportConfirmStepProps {
  preview: any;
  vendorLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}


export function ImportConfirmStep(props: ImportConfirmStepProps) {
  const { preview, vendorLabel, onConfirm, onCancel } = props;

  const conversationCount = preview.stats?.conversationsImported || 0;
  const messageCount = preview.stats?.messagesImported || 0;
  const hasWarnings = preview.warnings?.length > 0;
  const hasErrors = preview.errors?.length > 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* Summary */}
      <Alert variant='soft' color='primary' startDecorator={<InfoIcon />}>
        <Box>
          <Typography level='title-sm'>Ready to Import</Typography>
          <Typography level='body-sm'>
            {conversationCount} conversation{conversationCount !== 1 ? 's' : ''} with {messageCount} message{messageCount !== 1 ? 's' : ''}
          </Typography>
        </Box>
      </Alert>

      {/* Warnings */}
      {hasWarnings && (
        <>
          <Alert variant='soft' color='warning' startDecorator={<WarningIcon />}>
            <Typography level='title-sm'>Warnings</Typography>
          </Alert>
          <List size='sm'>
            {preview.warnings.slice(0, 5).map((warning: any, idx: number) => (
              <ListItem key={idx}>
                <Typography level='body-sm'>
                  {warning.message}
                </Typography>
              </ListItem>
            ))}
            {preview.warnings.length > 5 && (
              <ListItem>
                <Typography level='body-sm' fontStyle='italic'>
                  ... and {preview.warnings.length - 5} more warning{preview.warnings.length - 5 !== 1 ? 's' : ''}
                </Typography>
              </ListItem>
            )}
          </List>
        </>
      )}

      {/* Errors */}
      {hasErrors && (
        <>
          <Alert variant='soft' color='danger'>
            <Typography level='title-sm'>Errors</Typography>
          </Alert>
          <List size='sm'>
            {preview.errors.map((error: any, idx: number) => (
              <ListItem key={idx}>
                <Typography level='body-sm' color='danger'>
                  {error.message}
                </Typography>
              </ListItem>
            ))}
          </List>
        </>
      )}

      <Divider />

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button
          variant='plain'
          color='neutral'
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          variant='solid'
          color='primary'
          onClick={onConfirm}
          disabled={hasErrors}
        >
          Import {conversationCount} Conversation{conversationCount !== 1 ? 's' : ''}
        </Button>
      </Box>

    </Box>
  );
}
