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
import { addChatLinkItem, useLinkStorageOwnerId } from '../store-module-trade';
import { conversationToJsonV1 } from '../trade.client';


export function ChatLinkExport(props: {
  conversationId: DConversationId | null;
  enableSharing: boolean;
  onClose: () => void;
}) {

  // state
  const [chatLinkConfirmId, setChatLinkConfirmId] = React.useState<DConversationId | null>(null);
  const [chatLinkUploading, setChatLinkUploading] = React.useState(false);
  const [chatLinkResponse, setChatLinkResponse] = React.useState<StoragePutSchema | null>(null);

  // external state
  const { novel: chatLinkBadge, touch: clearChatLinkBadge } = useUICounter('share-chat-link');
  const { linkStorageOwnerId, setLinkStorageOwnerId } = useLinkStorageOwnerId();


  const handleChatLinkCreate = () => setChatLinkConfirmId(props.conversationId);

  const handleChatLinkConfirmed = async () => {
    if (!chatLinkConfirmId) return;

    const conversation = getConversation(chatLinkConfirmId);
    setChatLinkConfirmId(null);
    if (!conversation) return;

    setChatLinkUploading(true);
    try {
      const chatV1 = conversationToJsonV1(conversation);
      const chatTitle = conversationTitle(conversation) || undefined;
      const response: StoragePutSchema = await apiAsyncNode.trade.storagePut.mutate({
        ownerId: linkStorageOwnerId,
        dataType: 'CHAT_V1',
        dataTitle: chatTitle,
        dataObject: chatV1,
      });
      setChatLinkResponse(response);
      if (response.type === 'success') {
        addChatLinkItem(chatTitle, response.objectId, response.createdAt, response.expiresAt, response.deletionKey);
        if (!linkStorageOwnerId)
          setLinkStorageOwnerId(response.ownerId);
      }
      clearChatLinkBadge();
    } catch (error: any) {
      setChatLinkResponse({
        type: 'error',
        error: error?.message ?? error?.toString() ?? 'unknown error',
      });
    }
    setChatLinkUploading(false);
  };


  const hasConversation = !!props.conversationId;


  return <>

    <Badge color='danger' invisible={!chatLinkBadge}>
      <Button variant='soft' disabled={!hasConversation || chatLinkUploading}
              loading={chatLinkUploading}
              color={chatLinkResponse ? 'success' : 'primary'}
              endDecorator={chatLinkResponse ? <DoneIcon /> : <IosShareIcon />}
              sx={{ minWidth: 240, justifyContent: 'space-between' }}
              onClick={handleChatLinkCreate}>
        Share on {Brand.Title.Base}
      </Button>
    </Badge>

    {/* [chat link] confirmation */}
    {!!chatLinkConfirmId && (
      <ConfirmationModal
        open onClose={() => setChatLinkConfirmId(null)} onPositive={handleChatLinkConfirmed}
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
    {!!chatLinkResponse && (
      <ChatLinkDetails open onClose={() => setChatLinkResponse(null)} storageItem={chatLinkResponse} />
    )}

  </>;
}