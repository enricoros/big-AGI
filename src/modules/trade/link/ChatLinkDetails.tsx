import * as React from 'react';
import TimeAgo from 'react-timeago';

import { Box, Button, Card, IconButton, Input, Stack, Tooltip, Typography } from '@mui/joy';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DoneIcon from '@mui/icons-material/Done';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import IosShareIcon from '@mui/icons-material/IosShare';
import LaunchIcon from '@mui/icons-material/Launch';
import LinkIcon from '@mui/icons-material/Link';

import { Brand } from '~/common/app.config';
import { ConfirmationModal } from '~/common/components/ConfirmationModal';
import { GoodModal } from '~/common/components/GoodModal';
import { InlineError } from '~/common/components/InlineError';
import { InlineTextarea } from '~/common/components/InlineTextarea';
import { Link } from '~/common/components/Link';
import { apiAsyncNode } from '~/common/util/trpc.client';
import { copyToClipboard } from '~/common/util/clipboardUtils';
import { getChatLinkRelativePath } from '~/common/app.routes';
import { getOriginUrl } from '~/common/util/urlUtils';
import { webShare, webSharePresent } from '~/common/util/pwaUtils';

import type { StorageDeleteSchema, StoragePutSchema } from '../server/link';
import { forgetChatLinkItem } from './store-link';


export function ChatLinkDetails(props: {
  open: boolean,
  onClose: () => void,
  storageItem: StoragePutSchema,
  onChangeDeletionKey: (deletionKey: string) => void,
}) {

  // state
  const [opened, setOpened] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [native, setNative] = React.useState(false);
  const [isEditingDeletionKey, setIsEditingDeletionKey] = React.useState(false);
  const [confirmDeletion, setConfirmDeletion] = React.useState(false);
  const [deletionResponse, setDeletionResponse] = React.useState<StorageDeleteSchema | null>(null);

  // in case of 'put' error, just display the message
  if (props.storageItem.type === 'error') {
    return (
      <GoodModal title='❌ Upload Error' dividers open={props.open} onClose={props.onClose}>
        <InlineError error={props.storageItem.error} />
      </GoodModal>
    );
  }

  // success
  const { objectId, deletionKey, expiresAt, dataTitle } = props.storageItem;
  const relativeUrl = getChatLinkRelativePath(objectId);
  const fullUrl = getOriginUrl() + relativeUrl;


  // Deletion Key Edit

  const handleKeyEditBegin = () => setIsEditingDeletionKey(true);

  const handleKeyEditCancel = () => setIsEditingDeletionKey(false);

  const handleKeyEditChange = (text: string) => {
    if (text) {
      setIsEditingDeletionKey(false);
      props.onChangeDeletionKey(text.trim());
    }
  };

  // Deletion Key Copy

  const handleKeyCopy = () => {
    copyToClipboard(deletionKey, 'Link Deletion Key');
  };


  const onOpen = () => setOpened(true);

  const onCopy = () => {
    copyToClipboard(fullUrl, 'Public link');
    setCopied(true);
  };

  const onNativeShare = () => webShare(
    Brand.Title.Base + (dataTitle ? ` - ${dataTitle}` : ' - Shared Chat'),
    'Check this out!',
    fullUrl,
    () => setNative(true),
  );

  const onDeleteNow = () => setConfirmDeletion(true);

  const onDeleteCancelled = () => setConfirmDeletion(false);

  const onConfirmedDeletion = async () => {
    const result: StorageDeleteSchema = await apiAsyncNode.trade.storageDelete.mutate({ objectId, deletionKey });
    setDeletionResponse(result);
    if (result.type === 'success')
      forgetChatLinkItem(objectId);
    setConfirmDeletion(false);
  };

  const tryDeleted = !!deletionResponse;
  const isDeleted = deletionResponse?.type === 'success';


  return (
    <GoodModal title='🔗 Link created' strongerTitle noTitleBar={isDeleted} dividers={!isDeleted} open onClose={props.onClose}>

      {/* Success */}
      {!tryDeleted && <Card variant='solid' color='primary' invertedColors>

        <Typography level='title-md'>
          🚀 Ready to share
        </Typography>
        <Typography level='body-sm'>
          {fullUrl}
        </Typography>

        <Stack direction='row' gap={1}>
          <Tooltip title='Open the link in a new tab'>
            <Button
              variant={opened ? 'soft' : 'solid'} onClick={onOpen}
              color={opened ? 'success' : undefined} endDecorator={opened ? <DoneIcon /> : <LaunchIcon />}
              component={Link} href={relativeUrl} noLinkStyle
              sx={{ flexGrow: 1 }}
            >
              Open
            </Button>
          </Tooltip>

          <Tooltip title='Copy the link to your clipboard'>
            <Button
              variant={copied ? 'soft' : 'solid'} onClick={onCopy}
              color={copied ? 'success' : undefined} endDecorator={copied ? <DoneIcon /> : <LinkIcon />}
              sx={{ flexGrow: 1 }}
            >
              Copy
            </Button>
          </Tooltip>

          {webSharePresent() &&
            <Tooltip title='Share the link using your device'>
              <Button
                variant={native ? 'soft' : 'solid'} onClick={onNativeShare}
                color={native ? 'success' : undefined} endDecorator={native ? <DoneIcon /> : <IosShareIcon />}
                sx={{ flexGrow: 1 }}
              >
                Share
              </Button>
            </Tooltip>}
        </Stack>

      </Card>}

      {/* Deleted */}
      {isDeleted && <Card variant='solid' color='danger' invertedColors>
        <Typography level='title-md'>
          🗑️ Link deleted
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

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isEditingDeletionKey ? (
            <InlineTextarea
              invertedColors
              initialText={deletionKey}
              onEdit={handleKeyEditChange}
              onCancel={handleKeyEditCancel}
              sx={{
                flexGrow: 1,
                ml: -1.5, mr: -0.5,
              }}
            />
          ) : (
            <Input
              readOnly
              variant='plain'
              value={deletionKey}
              endDecorator={
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Tooltip title='Edit Deletion Key'>
                    <IconButton
                      variant='soft'
                      color='primary'
                      disabled={isEditingDeletionKey}
                      onClick={handleKeyEditBegin}
                    >
                      <EditRoundedIcon />
                    </IconButton>
                  </Tooltip>
                  <IconButton
                    variant='soft'
                    color='primary'
                    disabled={isEditingDeletionKey}
                    onClick={handleKeyCopy}
                  >
                    <ContentCopyIcon />
                  </IconButton>
                </Box>
              }
              sx={{ flexGrow: 1 }}
            />
          )}
        </Box>


        <Typography level='body-sm'>
          IMPORTANT - <b>keep this key safe</b>, you will need it if you decide to delete the link at a later time,
          and it will not appear again once you close this dialog.
        </Typography>

        <Stack direction='row' gap={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          {!!expiresAt && (
            <Typography level='title-sm'>
              This chat will auto-expire <TimeAgo date={expiresAt} />.
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