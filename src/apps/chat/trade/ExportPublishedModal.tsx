import * as React from 'react';

import { Alert, Box, Button, Divider, Input, Modal, ModalDialog, Stack, Typography } from '@mui/joy';

import { Link } from '~/common/components/Link';

import type { PublishedSchema } from '~/modules/sharing/sharing.router';


/**
 * Displays the result of a Paste.gg paste as a modal dialog.
 * This is to give the user the chance to write down the deletion key, mainly.
 */
export function ExportPublishedModal(props: { onClose: () => void, response: PublishedSchema, open: boolean }) {
  if (!props.response || !props.response.url)
    return null;

  const { url, deletionKey, expires } = props.response;

  return (
    <Modal open={props.open} onClose={props.onClose}>
      <ModalDialog variant='outlined' color='neutral' sx={{ maxWidth: '100vw' }}>

        <Typography level='title-lg'>
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
            <Typography level='body-sm'>
              <b>Deletion key</b>
            </Typography>
            <Input readOnly variant='plain' value={deletionKey} sx={{ mt: 1, mb: 2 }} />
            <Typography level='body-sm' sx={{ mb: 1 }}>
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