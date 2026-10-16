import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Box, Checkbox, ListItemButton, ListItemDecorator, MenuItem, Switch, Typography } from '@mui/joy';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import CleaningServicesOutlinedIcon from '@mui/icons-material/CleaningServicesOutlined';
import CompressIcon from '@mui/icons-material/Compress';
import ForkRightIcon from '@mui/icons-material/ForkRight';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SettingsSuggestOutlinedIcon from '@mui/icons-material/SettingsSuggestOutlined';
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import { ChromelessItemButton } from '~/common/layout/optima/ChromelessItemButton';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { OptimaPanelGroupedList, OptimaPanelGroupGutter } from '~/common/layout/optima/panel/OptimaPanelGroupedList';
import { useChatStore } from '~/common/stores/chat/store-chats'; // may be replaced with a dedicated hook for the chat pane

import { useChatShowSystemMessages } from '../../store-app-chat';
import { WindowSplitControls } from './WindowSplitControls';


function VariformPaneFrame() {
  return (
    <OptimaPanelGroupGutter>
      <Typography level='body-sm'>
        To add variables within messages, please use the <Box component='span' sx={{ fontWeight: 600 }}>{'{{'}variable_name{'}}'}</Box> syntax.
      </Typography>
    </OptimaPanelGroupGutter>
  );
}


export const ChatPanelMemo = React.memo(ChatPanel);

function ChatPanel(props: {
  isMobile: boolean,
  conversationId: DConversationId | null,
  disableItems: boolean,
  hasConversations: boolean,
  isMessageSelectionMode: boolean,
  isVerticalSplit: boolean,
  onConversationBranch: (conversationId: DConversationId, messageId: string | null, addSplitPane: boolean) => void,
  onConversationClear: (conversationId: DConversationId) => void,
  onConversationFlatten: (conversationId: DConversationId) => void,
  // onConversationNew: (forceNoRecycle: boolean) => void,
  setIsMessageSelectionMode: (isMessageSelectionMode: boolean) => void,
}): React.ReactNode {

  // external state
  const [showSystemMessages, setShowSystemMessages] = useChatShowSystemMessages();

  const { isArchived, setArchived } = useChatStore(useShallow((state) => {
    const conversation = state.conversations.find(_c => _c.id === props.conversationId);
    return {
      isArchived: !conversation ? undefined : !!conversation.isArchived,
      setArchived: state.setArchived,
    };
  }));


  // Actions

  const handleConversationRestart = (event: React.MouseEvent<HTMLDivElement>) => {
    props.conversationId && props.onConversationClear(props.conversationId);
  };

  const handleConversationBranch = (event: React.MouseEvent<HTMLDivElement>) => {
    props.conversationId && props.onConversationBranch(props.conversationId, null, true);
  };

  const handleConversationFlatten = (event: React.MouseEvent<HTMLElement>) => {
    props.conversationId && props.onConversationFlatten(props.conversationId);
  };

  const handleToggleMessageSelectionMode = (event: React.MouseEvent) => {
    props.setIsMessageSelectionMode(!props.isMessageSelectionMode);
  };

  const handleToggleArchive = React.useCallback(() => {
    if (!props.conversationId || !setArchived) return;
    setArchived(props.conversationId, !isArchived);
  }, [isArchived, props.conversationId, setArchived]);

  const handleToggleSystemMessages = () => setShowSystemMessages(!showSystemMessages);


  return <>

    {/* Window group */}
    <OptimaPanelGroupedList title='Window' hideExpandedCheckbox persistentCollapsibleId='chat-window'>

      <WindowSplitControls isVerticalSplit={props.isVerticalSplit} />

      {props.isMobile && <ChromelessItemButton />}

    </OptimaPanelGroupedList>

    {/* Chat Actions group */}
    <OptimaPanelGroupedList title='Actions' hideExpandedCheckbox persistentCollapsibleId='chat-actions'>
      {/* Use 2 columns */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>

        {/* Left column */}
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>

          <MenuItem disabled={props.disableItems} onClick={handleToggleArchive}>
            <ListItemDecorator>{isArchived ? <UnarchiveOutlinedIcon /> : <ArchiveOutlinedIcon />}</ListItemDecorator>
            {isArchived ? <b>Unarchive</b> : 'Archive'}
          </MenuItem>

          <MenuItem disabled={props.disableItems} onClick={handleConversationBranch}>
            <ListItemDecorator><ForkRightIcon /></ListItemDecorator>
            Branch
          </MenuItem>

        </Box>

        {/* Right column */}
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>

          <MenuItem disabled={props.disableItems} onClick={handleConversationFlatten}>
            <ListItemDecorator><CompressIcon /></ListItemDecorator>
            Compact
          </MenuItem>

          <MenuItem disabled={props.disableItems} onClick={handleConversationRestart}>
            <ListItemDecorator><RestartAltIcon /></ListItemDecorator>
            <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'space-between', gap: 1 }}>
              Restart
              {/*{!props.disableItems && <KeyStroke combo='Ctrl + Shift + X' />}*/}
            </Box>
          </MenuItem>

        </Box>
      </Box>

      {/* Spans both columns */}
      <MenuItem
        disabled={props.disableItems}
        color={props.isMessageSelectionMode ? 'warning' : 'neutral'}
        variant={props.isMessageSelectionMode ? 'solid' : 'plain'}
        onClick={handleToggleMessageSelectionMode}
        sx={props.isMessageSelectionMode ? { fontWeight: 'lg' } : {}}
      >
        <ListItemDecorator>{!props.isMessageSelectionMode ? <CleaningServicesOutlinedIcon /> : <Checkbox size='md' color='warning' variant='plain' checked />}</ListItemDecorator>
        Cleanup
      </MenuItem>

    </OptimaPanelGroupedList>

    {/* ... how do we name this? ... */}
    <OptimaPanelGroupedList title='Persona' hideExpandedCheckbox persistentCollapsibleId='chat-persona'>
      <ListItemButton disabled={props.disableItems} onClick={handleToggleSystemMessages}>
        <ListItemDecorator><SettingsSuggestOutlinedIcon /></ListItemDecorator>
        Show Instruction
        {/*<FormLabelStart title='View System Instruction' />*/}
        <Switch size='sm' checked={showSystemMessages} disabled={props.disableItems} onChange={handleToggleSystemMessages} sx={{ ml: 'auto' }} />
        {/*<Checkbox size='md' checked={showSystemMessages} disabled={props.disableItems} sx={{ ml: 'auto' }} />*/}
      </ListItemButton>
    </OptimaPanelGroupedList>

  </>;
}
