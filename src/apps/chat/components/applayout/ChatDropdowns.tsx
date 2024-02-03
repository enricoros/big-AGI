import * as React from 'react';

import { IconButton } from '@mui/joy';
import VerticalSplitIcon from '@mui/icons-material/VerticalSplit';
import VerticalSplitOutlinedIcon from '@mui/icons-material/VerticalSplitOutlined';

import type { DConversationId } from '~/common/state/store-chats';
import { GoodTooltip } from '~/common/components/GoodTooltip';
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
    {labsSplitBranching && (
      <GoodTooltip title={props.isSplitPanes ? 'Close Split Panes' : 'Split Conversation Vertically'}>
        <IconButton
          variant={props.isSplitPanes ? 'outlined' : undefined}
          onClick={props.onToggleSplitPanes}
          // sx={{ mx: 'auto' }}
        >
          {props.isSplitPanes ? <VerticalSplitIcon /> : <VerticalSplitOutlinedIcon />}
        </IconButton>
      </GoodTooltip>
    )}

  </>;
}
