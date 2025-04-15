import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Box, Checkbox, IconButton, ListItem, ListItemButton, ListItemDecorator, MenuItem, Switch, Tooltip, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import CleaningServicesOutlinedIcon from '@mui/icons-material/CleaningServicesOutlined';
import CompressIcon from '@mui/icons-material/Compress';
import EngineeringIcon from '@mui/icons-material/Engineering';
import ForkRightIcon from '@mui/icons-material/ForkRight';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SettingsSuggestOutlinedIcon from '@mui/icons-material/SettingsSuggestOutlined';
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import { CodiconSplitHorizontal } from '~/common/components/icons/CodiconSplitHorizontal';
import { CodiconSplitHorizontalRemove } from '~/common/components/icons/CodiconSplitHorizontalRemove';
import { CodiconSplitVertical } from '~/common/components/icons/CodiconSplitVertical';
import { CodiconSplitVerticalRemove } from '~/common/components/icons/CodiconSplitVerticalRemove';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { OptimaPanelGroupedList, OptimaPanelGroupGutter } from '~/common/layout/optima/panel/OptimaPanelGroupedList';
import { optimaActions } from '~/common/layout/optima/useOptima';
import { useChatStore } from '~/common/stores/chat/store-chats'; // may be replaced with a dedicated hook for the chat pane
import { useLabsDevMode } from '~/common/stores/store-ux-labs';

import { useChatShowSystemMessages } from '../../store-app-chat';
import { panesManagerActions, usePaneDuplicateOrClose } from '../panes/store-panes-manager';


function VariformPaneFrame() {
  return (
    <OptimaPanelGroupGutter>
      <Typography level='body-sm'>
        To add variables within messages, please use the <Box component='span' sx={{ fontWeight: 600 }}>{'{{'}variable_name{'}}'}</Box> syntax.
      </Typography>
    </OptimaPanelGroupGutter>
  );
}


export function ChatPane(props: {
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
  const { canAddPane, isMultiPane } = usePaneDuplicateOrClose();
  const [showSystemMessages, setShowSystemMessages] = useChatShowSystemMessages();
  const labsDevMode = useLabsDevMode();

  const { isArchived, setArchived } = useChatStore(useShallow((state) => {
    const conversation = state.conversations.find(_c => _c.id === props.conversationId);
    return {
      isArchived: !conversation ? undefined : !!conversation.isArchived,
      setArchived: state.setArchived,
    };
  }));


  // Window

  const handleIncreaseMultiPane = React.useCallback((event?: React.MouseEvent) => {
    event?.stopPropagation();

    // create a new pane with the current conversation
    // duplicateFocusedPane();

    // create a new empty pane
    panesManagerActions().insertEmptyAfterFocusedPane(true);

    // load a brand new conversation inside
    // FIXME: still testing this
    // props.onConversationNew(true);
  }, []);

  const handleToggleMultiPane = React.useCallback((_event: React.MouseEvent) => {
    if (isMultiPane)
      panesManagerActions().removeNonFocusedPanes();
    else
      handleIncreaseMultiPane(undefined);
  }, [handleIncreaseMultiPane, isMultiPane]);


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
    <OptimaPanelGroupedList title='Window'>

      <ListItem
        endAction={!isMultiPane ? undefined : (
          <Tooltip title='Add Another Split'>
            <IconButton
              size='sm'
              variant='outlined'
              disabled={!canAddPane}
              onClick={handleIncreaseMultiPane}
              sx={{ ml: 'auto', /*mr: '2px',*/ my: '-0.25rem' /* absorb the menuItem padding */ }}
            >
              <AddIcon />
            </IconButton>
          </Tooltip>
        )}
      >
        <ListItemButton onClick={handleToggleMultiPane}>
          <ListItemDecorator>{props.isVerticalSplit
            ? (isMultiPane ? <CodiconSplitVerticalRemove /> : <CodiconSplitVertical />)
            : (isMultiPane ? <CodiconSplitHorizontalRemove /> : <CodiconSplitHorizontal />)
          }</ListItemDecorator>
          {props.isVerticalSplit
            ? (isMultiPane ? 'Unsplit' : 'Split Down')
            : (isMultiPane ? 'Unsplit' : 'Split Right')}
        </ListItemButton>
      </ListItem>

    </OptimaPanelGroupedList>

    {/* Chat Actions group */}
    <OptimaPanelGroupedList title='Actions'>

      <MenuItem disabled={props.disableItems} onClick={handleToggleArchive}>
        <ListItemDecorator>{isArchived ? <UnarchiveOutlinedIcon /> : <ArchiveOutlinedIcon />}</ListItemDecorator>
        {isArchived ? <b>Unarchive</b> : 'Archive'}
      </MenuItem>

      <MenuItem disabled={props.disableItems} onClick={handleConversationBranch}>
        <ListItemDecorator><ForkRightIcon /></ListItemDecorator>
        Branch
      </MenuItem>

      <MenuItem disabled={props.disableItems} onClick={handleConversationRestart}>
        <ListItemDecorator><RestartAltIcon /></ListItemDecorator>
        <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'space-between', gap: 1 }}>
          Restart
          {/*{!props.disableItems && <KeyStroke combo='Ctrl + Shift + X' />}*/}
        </Box>
      </MenuItem>

      <MenuItem disabled={props.disableItems} onClick={handleConversationFlatten}>
        <ListItemDecorator><CompressIcon /></ListItemDecorator>
        Minify
      </MenuItem>

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
    <OptimaPanelGroupedList title='Persona'>
      <ListItemButton disabled={props.disableItems} onClick={handleToggleSystemMessages}>
        <ListItemDecorator><SettingsSuggestOutlinedIcon /></ListItemDecorator>
        System Instruction
        {/*<FormLabelStart title='View System Instruction' />*/}
        <Switch size='md' checked={showSystemMessages} disabled={props.disableItems} onChange={handleToggleSystemMessages} sx={{ ml: 'auto' }} />
        {/*<Checkbox size='md' checked={showSystemMessages} disabled={props.disableItems} sx={{ ml: 'auto' }} />*/}
      </ListItemButton>
    </OptimaPanelGroupedList>

    {/* [DEV] Development */}
    {labsDevMode && (
      <OptimaPanelGroupedList title='[Developers]'>
        <MenuItem onClick={optimaActions().openAIXDebugger}>
          <ListItemDecorator><EngineeringIcon /></ListItemDecorator>
          AIX: Show Last Request...
        </MenuItem>
      </OptimaPanelGroupedList>
    )}

  </>;
}