import * as React from 'react';

import { IconButton } from '@mui/joy';
import VerticalSplitIcon from '@mui/icons-material/VerticalSplit';

import type { DConversationId } from '~/common/state/store-chats';
import { useUXLabsStore } from '~/common/state/store-ux-labs';

import { useChatLLMDropdown } from './useLLMDropdown';
import { usePersonaIdDropdown } from './usePersonaDropdown';
import { useFolderDropdown } from './folder/useFolderDropdown';


export function ChatDropdowns(props: {
  conversationId: DConversationId | null
  isSplitPanes: boolean
  onToggleSplitPanes: () => void
}) {

  // state
  const { chatLLMDropdown } = useChatLLMDropdown();
  const { personaDropdown } = usePersonaIdDropdown(props.conversationId);
  const { folderDropdown } = useFolderDropdown(props.conversationId);

  // external state
  const labsSplitBranching = useUXLabsStore(state => state.labsSplitBranching);

  return <>

    {/* Persona selector */}
    {personaDropdown}

    {/* Model selector */}
    {chatLLMDropdown}

    {/* Folder selector */}
    {folderDropdown}

    {/* Split Panes button */}
    {labsSplitBranching && <IconButton
      variant={props.isSplitPanes ? 'solid' : undefined}
      onClick={props.onToggleSplitPanes}
      // sx={{
      //   ml: 'auto',
      // }}
    >
      <VerticalSplitIcon />
    </IconButton>}

  </>;
}
