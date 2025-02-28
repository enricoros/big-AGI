import * as React from 'react';
import { Sheet } from '@mui/joy';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import { useConversationTitle } from '~/common/stores/chat/hooks/useConversationTitle';


const _style = {
  position: 'absolute',
  top: 0,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 10,
  p: '1px 1rem 4px',
  fontSize: 'sm',
  fontWeight: 'md',
  borderBottomLeftRadius: '8px',
  borderBottomRightRadius: '8px',
  // boxShadow: 'xs',
  // border: '1px solid',
  // borderColor: 'background.popup',
  borderTop: 'none',
  maxWidth: '78%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;


export function PaneTitleOverlay(props: { conversationId: DConversationId | null, isFocused: boolean }) {

  // external state
  const title = useConversationTitle(props.conversationId);
  if (!title || title?.length < 3)
    return null;

  // don't render if not focused
  // if (!props.isFocused)
  //   return null;

  return (
    <Sheet
      color={props.isFocused ? 'primary' : 'neutral'}
      variant={props.isFocused ? 'solid' : 'outlined'}
      sx={_style}
    >
      {title}
    </Sheet>
  );
}