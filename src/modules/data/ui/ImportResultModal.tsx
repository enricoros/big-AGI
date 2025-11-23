/**
 * Display results after import completion
 */

import * as React from 'react';
import { Alert, Box, Divider, List, ListItem, Typography } from '@mui/joy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';

import { GoodModal } from '~/common/components/modals/GoodModal';
import type { ImportResult } from '../data.types';


interface ImportResultModalProps {
  result: ImportResult;
  vendorLabel: string;
  onClose: () => void;
}


export function ImportResultModal(props: ImportResultModalProps) {
  const { result, vendorLabel, onClose } = props;

  const { success, stats, warnings, errors } = result;
  const hasWarnings = warnings.length > 0;
  const hasErrors = errors.length > 0;

  return (
    <GoodModal
      open
      title={success ? 'Import Successful' : 'Import Failed'}
      strongerTitle
      onClose={onClose}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

      <Divider />

      {/* Success summary */}
      {success && (
        <Alert variant='soft' color='success' startDecorator={<CheckCircleIcon />}>
          <Box>
            <Typography level='title-sm'>Import Complete</Typography>
            <Typography level='body-sm'>
              Imported {stats.conversationsImported} conversation{stats.conversationsImported !== 1 ? 's' : ''} with {stats.messagesImported} message{stats.messagesImported !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Alert>
      )}

      {/* Error summary */}
      {!success && (
        <Alert variant='soft' color='danger' startDecorator={<ErrorIcon />}>
          <Box>
            <Typography level='title-sm'>Import Failed</Typography>
            <Typography level='body-sm'>
              {errors[0]?.message || 'Unknown error occurred'}
            </Typography>
          </Box>
        </Alert>
      )}

      {/* Statistics */}
      {success && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography level='title-sm'>Import Statistics</Typography>
          <List size='sm'>
            <ListItem>Conversations: {stats.conversationsImported}</ListItem>
            <ListItem>Messages: {stats.messagesImported}</ListItem>
            {stats.charactersImported > 0 && (
              <ListItem>Characters: {stats.charactersImported.toLocaleString()}</ListItem>
            )}
            {stats.unsupportedItemsSkipped > 0 && (
              <ListItem>Unsupported items skipped: {stats.unsupportedItemsSkipped}</ListItem>
            )}
          </List>
        </Box>
      )}

      {/* Warnings */}
      {hasWarnings && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Alert variant='soft' color='warning' startDecorator={<WarningIcon />}>
            <Typography level='title-sm'>
              {warnings.length} Warning{warnings.length !== 1 ? 's' : ''}
            </Typography>
          </Alert>
          <List size='sm'>
            {warnings.slice(0, 10).map((warning, idx) => (
              <ListItem key={idx}>
                <Typography level='body-sm'>
                  [{warning.type}] {warning.message}
                </Typography>
              </ListItem>
            ))}
            {warnings.length > 10 && (
              <ListItem>
                <Typography level='body-sm' fontStyle='italic'>
                  ... and {warnings.length - 10} more warning{warnings.length - 10 !== 1 ? 's' : ''}
                </Typography>
              </ListItem>
            )}
          </List>
        </Box>
      )}

      {/* Errors (non-fatal) */}
      {hasErrors && success && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Alert variant='soft' color='danger' startDecorator={<ErrorIcon />}>
            <Typography level='title-sm'>
              {errors.length} Error{errors.length !== 1 ? 's' : ''}
            </Typography>
          </Alert>
          <List size='sm'>
            {errors.slice(0, 5).map((error, idx) => (
              <ListItem key={idx}>
                <Typography level='body-sm' color='danger'>
                  [{error.type}] {error.message}
                </Typography>
              </ListItem>
            ))}
            {errors.length > 5 && (
              <ListItem>
                <Typography level='body-sm' fontStyle='italic'>
                  ... and {errors.length - 5} more error{errors.length - 5 !== 1 ? 's' : ''}
                </Typography>
              </ListItem>
            )}
          </List>
        </Box>
      )}

      {/* Information */}
      <Typography level='body-sm' sx={{ mt: 2 }}>
        {success
          ? `The imported conversations are now available in your chat list. ${stats.conversationsImported > 1 ? 'The most recent conversation is' : 'It is'} now active.`
          : 'Please check the error messages above and try again with a valid export file.'
        }
      </Typography>

      </Box>
    </GoodModal>
  );
}
