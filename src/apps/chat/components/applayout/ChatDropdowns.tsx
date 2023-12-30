import * as React from 'react';

import { IconButton } from '@mui/joy';
import VerticalSplitIcon from '@mui/icons-material/VerticalSplit';

import type { DConversationId } from '~/common/state/store-chats';
import { useUXLabsStore } from '~/common/state/store-ux-labs';

import { useChatLLMDropdown } from './useLLMDropdown';
import { usePersonaIdDropdown } from './usePersonaDropdown';


export function ChatDropdowns(props: {
  conversationId: DConversationId | null
  isSplitPanes: boolean
  onToggleSplitPanes: () => void
}) {

  // state
  const { chatLLMDropdown } = useChatLLMDropdown();
  const { personaDropdown } = usePersonaIdDropdown(props.conversationId);

  // external state
  const labsSplitBranching = true; ///useUXLabsStore(state => state.labsSplitBranching);

  return <>

    {/* Model selector */}
    {chatLLMDropdown}

    {/* Persona selector */}
    {personaDropdown}

    {/* Split Panes button */}
    {labsSplitBranching && <IconButton
      variant={props.isSplitPanes ? 'solid' : 'soft'}
      onClick={props.onToggleSplitPanes}
      sx={{
        ml: 'auto',
      }}
    >
      <VerticalSplitIcon />
    </IconButton>}

  </>;
}
