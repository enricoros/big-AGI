import * as React from 'react';

import { Button, Card, Input, Stack, Typography } from '@mui/joy';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DoneIcon from '@mui/icons-material/Done';
import IosShareIcon from '@mui/icons-material/IosShare';
import LaunchIcon from '@mui/icons-material/Launch';
import LinkIcon from '@mui/icons-material/Link';

import { Brand } from '~/common/brand';
import { ConfirmationModal } from '~/common/components/ConfirmationModal';
import { GoodModal } from '~/common/components/GoodModal';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { apiAsyncNode } from '~/common/util/trpc.client';
import { copyToClipboard } from '~/common/util/copyToClipboard';
import { getOriginUrl } from '~/common/util/urlUtils';
import { getSharingRelativePath } from '~/common/routes';
import { webShare, webSharePresent } from '~/common/util/pwaUtils';

import { type ShareDeleteSchema, type SharePutSchema } from './server/trade.router';


export function ExportSharedModal(props: { onClose: () => void, response: SharePutSchema, open: boolean }) {

  // state
  const [opened, setOpened] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [shared, setShared] = React.useState(false);
  const [confirmDeletion, setConfirmDeletion] = React.useState(false);
  const [deletionResponse, setDeletionResponse] = React.useState<ShareDeleteSchema | null>(null);

  // in case of 'put' error, just display the message
  if (props.response.type === 'error') {
    return (
      <GoodModal title='Upload Error' dividers open={props.open} onClose={props.onClose}>
        <InlineError error={props.response.error} />
      </GoodModal>
    );
  }

  // success
  const { sharedId, deletionKey, expiresAt } = props.response;
  const relativeUrl = getSharingRelativePath(sharedId);
  const fullUrl = getOriginUrl() + relativeUrl;


  const onOpen = () => setOpened(true);

  const onCopy = () => {
    copyToClipboard(fullUrl);
    setCopied(true);
  };

  const onShare = async () => webShare(Brand.Title.Common, 'Check out this chat!', fullUrl,
    () => setShared(true));


  const onDeleteNow = () => setConfirmDeletion(true);

  const onDeleteCancelled = () => setConfirmDeletion(false);

  const onConfirmedDeletion = async () => {
    const result: ShareDeleteSchema = await apiAsyncNode.trade.shareDelete.mutate({ sharedId, deletionKey });
    setDeletionResponse(result);
    setConfirmDeletion(false);
  };

  const tryDeleted = !!deletionResponse;
  const isDeleted = deletionResponse?.type === 'success';


  return (
    <GoodModal title='Link created' strongerTitle noTitleBar={isDeleted} dividers={!isDeleted} open onClose={props.onClose}>

      {/* Success */}
      {!tryDeleted && <Card variant='solid' color='primary' invertedColors>

        <Typography level='title-md'>
          Ready to share!
        </Typography>
        <Typography level='body-sm'>
          {fullUrl}
        </Typography>

        <Stack direction='row' gap={1}>
          <Button
            variant={opened ? 'soft' : 'solid'} onClick={onOpen}
            color={opened ? 'success' : undefined} endDecorator={opened ? <DoneIcon /> : <LaunchIcon />}
            component={Link} href={relativeUrl} target='_blank' noLinkStyle
            sx={{ flexGrow: 1 }}
          >
            Open
          </Button>

          <Button
            variant={copied ? 'soft' : 'solid'} onClick={onCopy}
            color={copied ? 'success' : undefined} endDecorator={copied ? <DoneIcon /> : <LinkIcon />}
            sx={{ flexGrow: 1 }}
          >
            Copy
          </Button>

          {webSharePresent() &&
            <Button
              variant={shared ? 'soft' : 'solid'} onClick={onShare}
              color={shared ? 'success' : undefined} endDecorator={shared ? <DoneIcon /> : <IosShareIcon />}
              sx={{ flexGrow: 1 }}
            >
              Share
            </Button>}
        </Stack>

      </Card>}

      {/* Deleted */}
      {isDeleted && <Card variant='solid' color='danger' invertedColors>
        <Typography level='title-md'>
          Link deleted
        </Typography>
        <Typography level='body-sm'>
          This link has been deleted
        </Typography>
      </Card>}

      {/* Deletion and Expiration */}
      {!isDeleted && <Card variant='soft'>

        <Typography level='title-sm'>
          Deletion Key
        </Typography>

        <Input readOnly variant='plain' value={deletionKey} sx={{ flexGrow: 1 }} />

        <Typography level='body-sm'>
          IMPORTANT - <b>keep this key safe</b>, you will need it if you decide to delete the link at a later time,
          and it will not appear again once you close this dialog.
        </Typography>

        <Stack direction='row' gap={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          {!!expiresAt && (
            <Typography level='title-sm'>
              This chat will auto-expire on {expiresAt.toLocaleString()}.
            </Typography>
          )}
          <Button variant='outlined' color='neutral' endDecorator={<DeleteForeverIcon />} onClick={onDeleteNow}>
            Delete Now
          </Button>
        </Stack>

      </Card>}

      {/* Delete confirmation */}
      <ConfirmationModal
        open={confirmDeletion} onClose={onDeleteCancelled} onPositive={onConfirmedDeletion}
        confirmationText={'Are you sure you want to delete this link?'} positiveActionText={'Yes, Delete'}
      />

    </GoodModal>
  );
}