import * as React from 'react';

import { Button } from '@mui/joy';
import DoneIcon from '@mui/icons-material/Done';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';

import { Brand } from '~/common/app.config';
import { ConfirmationModal } from '~/common/components/ConfirmationModal';
import { Link } from '~/common/components/Link';
import { addSnackbar } from '~/common/components/useSnackbarsStore';
import { apiAsyncNode } from '~/common/util/trpc.client';
import { conversationTitle, DConversationId, getConversation } from '~/common/state/store-chats';

import type { StoragePutSchema, StorageUpdateDeletionKeySchema } from '../server/link';
import { ChatLinkDetails } from './ChatLinkDetails';
import { conversationToJsonV1 } from '../trade.client';
import { rememberChatLinkItem, updateChatLinkDeletionKey, useLinkStorageOwnerId } from './store-link';


export function ChatLinkExport(props: {
  conversationId: DConversationId | null;
  enableSharing: boolean;
  onClose: () => void;
}) {

  // state
  const [confirmConversationId, setConfirmConversationId] = React.useState<DConversationId | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [linkPutResult, setLinkPutResult] = React.useState<StoragePutSchema | null>(null);

  // external state
  const { linkStorageOwnerId, setLinkStorageOwnerId } = useLinkStorageOwnerId();


  const handleConfirm = () => setConfirmConversationId(props.conversationId);

  const handleCancel = () => setConfirmConversationId(null);

  const handleCreate = async () => {
    if (!confirmConversationId) return;

    const conversation = getConversation(confirmConversationId);
    setConfirmConversationId(null);
    if (!conversation) return;

    setIsUploading(true);
    try {
      const chatV1 = conversationToJsonV1(conversation);
      const chatTitle = conversationTitle(conversation) || undefined;
      const response: StoragePutSchema = await apiAsyncNode.trade.storagePut.mutate({
        ownerId: linkStorageOwnerId,
        dataType: 'CHAT_V1',
        dataTitle: chatTitle,
        dataObject: chatV1,
      });
      setLinkPutResult(response);
      if (response.type === 'success') {
        if (!linkStorageOwnerId)
          setLinkStorageOwnerId(response.ownerId);
        rememberChatLinkItem(chatTitle, response.objectId, response.createdAt, response.expiresAt, response.deletionKey);
      }
    } catch (error: any) {
      setLinkPutResult({
        type: 'error',
        error: error?.message ?? error?.toString() ?? 'unknown error',
      });
    }
    setIsUploading(false);
  };

  const handleChangeDeletionKey = async (newKey: string) => {
    if (!linkPutResult || linkPutResult.type !== 'success') return;
    const { objectId, deletionKey: formerKey } = linkPutResult;
    if (!objectId || !formerKey || !newKey || formerKey === newKey) return;

    // update it in the Storage
    try {
      const response: StorageUpdateDeletionKeySchema = await apiAsyncNode.trade.storageUpdateDeletionKey.mutate({
        objectId,
        formerKey,
        newKey,
      });
      if (response.type === 'error') {
        addSnackbar({
          key: 'chatlink-deletion-key-update-error',
          type: 'issue',
          message: `Failed to update deletion key: ${response.error}`,
        });
        return;
      }
    } catch (error: any) {
      addSnackbar({
        key: 'chatlink-deletion-key-update-exception',
        type: 'issue',
        message: `Failed to update deletion key: ${error?.message ?? error?.toString() ?? 'unknown error'}`,
      });
      return;
    }

    // update it in the local storage
    updateChatLinkDeletionKey(objectId, newKey);

    // update it in the status
    setLinkPutResult({
      ...linkPutResult,
      deletionKey: newKey,
    });
  };

  const handleCloseDetails = () => setLinkPutResult(null);


  const hasConversation = !!props.conversationId;


  return <>

    <Button
      variant='soft' disabled={!hasConversation || isUploading}
      loading={isUploading}
      color={linkPutResult ? 'success' : 'primary'}
      endDecorator={linkPutResult ? <DoneIcon /> : <ExitToAppIcon />}
      sx={{ minWidth: 240, justifyContent: 'space-between' }}
      onClick={handleConfirm}
    >
      Share Link · {Brand.Title.Base}
    </Button>

    {/* [chat link] confirmation */}
    {!!confirmConversationId && (
      <ConfirmationModal
        open onClose={handleCancel} onPositive={handleCreate}
        title='Upload Confirmation'
        confirmationText={<>
          Everyone who has the unlisted link will be able to access this chat.
          It will be automatically deleted after 30 days.
          For more information, please see the <Link href={Brand.URIs.PrivacyPolicy} target='_blank'>privacy
          policy</Link> of this server. <br />
          Do you wish to continue?
        </>}
        positiveActionText={'Yes, Create Link'}
      />
    )}

    {/* [chat link] response */}
    {!!linkPutResult && (
      <ChatLinkDetails
        open
        storageItem={linkPutResult}
        onClose={handleCloseDetails}
        onChangeDeletionKey={handleChangeDeletionKey}
      />
    )}

  </>;
}