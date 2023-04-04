import * as React from 'react';

import { Alert, Box, Button, Divider, Input, Modal, ModalDialog, Stack, Typography } from '@mui/joy';

import { ApiExportResponse } from '../../pages/api/export';
import { Link } from '@/components/util/Link';


/**
 * Displays the result of a conversation export as a modal dialog.
 * This is to give the user the chance to write down the deletion key, mainly.
 */
export function ExportOutcomeDialog(props: { onClose: () => void, response: ApiExportResponse, open: boolean }) {
  if (!props.response || props.response.type !== 'success')
    return null;

  const { url, deletionKey, expires } = props.response;

  return (
    <Modal open={props.open} onClose={props.onClose}>
      <ModalDialog variant='outlined' color='neutral' sx={{ maxWidth: '100vw' }}>

        <Typography level='h5'>
          Your conversation is live!
        </Typography>

        <Divider sx={{ my: 2 }} />

        <Typography>
          This is your link (opens in a new window)
        </Typography>
        <Typography sx={{ mt: 1 }}>
          <Link noLinkStyle href={url} target='_blank' sx={{ wordBreak: 'break-all' }}>
            {url}
          </Link>
        </Typography>

        <Alert variant='soft' color='neutral' sx={{ mt: 3, mb: 1 }}>
          <Stack>
            <Typography level='body2'>
              <b>Deletion key</b>
            </Typography>
            <Input readOnly variant='plain' value={deletionKey} sx={{ mt: 1, mb: 2 }} />
            <Typography level='body2' sx={{ mb: 1 }}>
              IMPORTANT - Keep this key safe! You will need it if you decide to delete the paste, and it will not appear again once you close this dialog.
            </Typography>
          </Stack>
        </Alert>

        {expires?.length >= 10 && (
          <Typography sx={{ mt: 1 }}>
            The conversation will be deleted on {new Date(expires).toLocaleString()}.
          </Typography>
        )}

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 2 }}>
          <Button variant='soft' color='neutral' onClick={props.onClose}>
            Close
          </Button>
        </Box>
      </ModalDialog>
    </Modal>
  );
}