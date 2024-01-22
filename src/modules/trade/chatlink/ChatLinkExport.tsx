import * as React from 'react';

import { Badge, Button } from '@mui/joy';
import DoneIcon from '@mui/icons-material/Done';
import IosShareIcon from '@mui/icons-material/IosShare';

import { Brand } from '~/common/app.config';
import { ConfirmationModal } from '~/common/components/ConfirmationModal';
import { Link } from '~/common/components/Link';
import { apiAsyncNode } from '~/common/util/trpc.client';
import { conversationTitle, DConversationId, getConversation } from '~/common/state/store-chats';
import { useUICounter } from '~/common/state/store-ui';

import type { StoragePutSchema } from '../server/link';
import { ChatLinkDetails } from './ChatLinkDetails';
import { conversationToJsonV1 } from '../trade.client';
import { rememberChatLinkItem, useLinkStorageOwnerId } from './store-chatlink';


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
  const { novel: chatLinkBadge, touch: clearChatLinkBadge } = useUICounter('share-chat-link');
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
      clearChatLinkBadge();
    } catch (error: any) {
      setLinkPutResult({
        type: 'error',
        error: error?.message ?? error?.toString() ?? 'unknown error',
      });
    }
    setIsUploading(false);
  };

  const handleCloseDetails = () => setLinkPutResult(null);


  const hasConversation = !!props.conversationId;


  return <>

    <Badge color='danger' invisible={!chatLinkBadge}>
      <Button variant='soft' disabled={!hasConversation || isUploading}
              loading={isUploading}
              color={linkPutResult ? 'success' : 'primary'}
              endDecorator={linkPutResult ? <DoneIcon /> : <IosShareIcon />}
              sx={{ minWidth: 240, justifyContent: 'space-between' }}
              onClick={handleConfirm}>
        Share on {Brand.Title.Base}
      </Button>
    </Badge>

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
      <ChatLinkDetails open storageItem={linkPutResult} onClose={handleCloseDetails} />
    )}

  </>;
}