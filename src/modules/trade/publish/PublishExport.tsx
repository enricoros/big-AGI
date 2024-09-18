import * as React from 'react';

import { Button } from '@mui/joy';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';

import { getChatShowSystemMessages } from '../../../apps/chat/store-app-chat';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import { Brand } from '~/common/app.config';
import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { Link } from '~/common/components/Link';
import { apiAsyncNode } from '~/common/util/trpc.client';
import { getConversation } from '~/common/stores/chat/store-chats';
import { isBrowser } from '~/common/util/pwaUtils';

import type { PublishedSchema } from '../server/pastegg';
import { PublishDetails } from './PublishDetails';
import { conversationToMarkdown } from '../trade.client';


/// Returns a pretty link to the current page, for promo
function linkToOrigin() {
  let origin = isBrowser ? window.location.href : '';
  if (!origin || origin.includes('//localhost'))
    origin = Brand.URIs.OpenRepo;
  origin = origin.replace('https://', '');
  if (origin.endsWith('/'))
    origin = origin.slice(0, -1);
  return origin;
}


export function PublishExport(props: {
  conversationId: DConversationId | null;
  onClose: () => void;
}) {

  // local state
  const [publishConversationId, setPublishConversationId] = React.useState<DConversationId | null>(null);
  const [publishUploading, setPublishUploading] = React.useState(false);
  const [publishResponse, setPublishResponse] = React.useState<PublishedSchema | null>(null);


  const handlePublishConversation = () => setPublishConversationId(props.conversationId);

  const handlePublishConfirmed = async () => {
    if (!publishConversationId) return;

    const conversation = getConversation(publishConversationId);
    setPublishConversationId(null);
    if (!conversation) return;

    setPublishUploading(true);
    const showSystemMessages = getChatShowSystemMessages();
    const markdownContent = conversationToMarkdown(conversation, !showSystemMessages, false);
    try {
      const paste = await apiAsyncNode.trade.publishTo.mutate({
        to: 'paste.gg',
        title: '🤖💬 Chat Conversation',
        fileContent: markdownContent,
        fileName: 'my-chat.md',
        origin: linkToOrigin(),
      });
      setPublishResponse(paste);
    } catch (error: any) {
      alert(`Failed to publish conversation: ${error?.message ?? error?.toString() ?? 'unknown error'}`);
      setPublishResponse(null);
    }
    setPublishUploading(false);
  };

  const handlePublishResponseClosed = () => {
    setPublishResponse(null);
    props.onClose();
  };


  const hasConversation = !!props.conversationId;


  return <>

    <Button
      variant='soft' disabled={!hasConversation || publishUploading}
      loading={publishUploading}
      color={publishResponse ? 'success' : 'primary'}
      endDecorator={<ShareOutlinedIcon />}
      sx={{ minWidth: 240, justifyContent: 'space-between' }}
      onClick={handlePublishConversation}
    >
      Share Copy · Paste.gg
    </Button>

    {/* [publish] confirmation */}
    {publishConversationId && (
      <ConfirmationModal
        open onClose={() => setPublishConversationId(null)} onPositive={handlePublishConfirmed}
        confirmationText={<>
          Share your conversation anonymously on <Link href='https://paste.gg' target='_blank'>paste.gg</Link>?
          It will be unlisted and available to share and read for 30 days. Keep in mind, deletion may not be possible.
          Do you wish to continue?
        </>} positiveActionText={'Understood, Upload to Paste.gg'}
      />
    )}

    {/* [publish] response */}
    {!!publishResponse && (
      <PublishDetails open onClose={handlePublishResponseClosed} response={publishResponse} />
    )}

  </>;
}