import * as React from 'react';

import { Box, Typography } from '@mui/joy';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

import { conversationAutoTitle } from '~/modules/aifn/autotitle/autoTitle';

import type { DConversationId } from '~/common/state/store-chats';
import { capitalizeFirstLetter } from '~/common/util/textUtils';

import { CHAT_NOVEL_TITLE } from '../AppChat';

import { FadeInButton } from './ChatDrawerItem';


export function ChatBarAltTitle(props: {
  conversationId: DConversationId | null,
  conversationTitle: string,
}) {

  // state
  const [isEditingTitle, setIsEditingTitle] = React.useState<boolean>(false);

  // derived state
  const { conversationId, conversationTitle } = props;
  const hasConversation = !!conversationId;


  const handleTitleEditAuto = React.useCallback(async () => {
    if (!conversationId) return;
    setIsEditingTitle(true);
    await conversationAutoTitle(conversationId, true);
    setIsEditingTitle(false);
  }, [conversationId]);


  return (
    <Box sx={{ display: 'flex', gap: { xs: 1, md: 3 }, alignItems: 'center' }}>

      <Typography>
        {capitalizeFirstLetter(conversationTitle?.trim() || CHAT_NOVEL_TITLE)}
      </Typography>

      {hasConversation && (
        <FadeInButton size='sm' disabled={isEditingTitle} onClick={handleTitleEditAuto}>
          <AutoFixHighIcon />
        </FadeInButton>
      )}

    </Box>
  );
}
