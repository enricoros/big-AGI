import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { ListDivider, ListItemDecorator, MenuItem, Switch } from '@mui/joy';
import CheckBoxOutlineBlankOutlinedIcon from '@mui/icons-material/CheckBoxOutlineBlankOutlined';
import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined';
import ClearIcon from '@mui/icons-material/Clear';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';

import { downloadConversationJson, useChatStore } from '@/common/state/store-chats';
import { useSettingsStore } from '@/common/state/store-settings';


export function ActionItems(props: {
  conversationId: string | null, isConversationEmpty: boolean,
  isMessageSelectionMode: boolean, setIsMessageSelectionMode: (isMessageSelectionMode: boolean) => void,
  onClearConversation: (conversationId: string) => void,
  onPublishConversation: (conversationId: string) => void
}) {

  // external state
  const { showSystemMessages, setShowSystemMessages } = useSettingsStore(state => ({
    showSystemMessages: state.showSystemMessages, setShowSystemMessages: state.setShowSystemMessages,
  }), shallow);

  const handleSystemMessagesToggle = () => setShowSystemMessages(!showSystemMessages);

  const handleConversationPublish = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    props.conversationId && props.onPublishConversation(props.conversationId);
  };

  const handleConversationDownload = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const conversation = useChatStore.getState().conversations.find(conversation => conversation.id === props.conversationId);
    if (conversation)
      downloadConversationJson(conversation);
  };

  const handleToggleMessageSelectionMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    /// FIXME closeActionsMenu();
    props.setIsMessageSelectionMode(!props.isMessageSelectionMode);
  };

  const handleConversationClear = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    props.conversationId && props.onClearConversation(props.conversationId);
  };

  const disabled = !props.conversationId || props.isConversationEmpty;

  return <>

    <ListDivider />

    <MenuItem onClick={handleSystemMessagesToggle}>
      <ListItemDecorator><SettingsSuggestIcon /></ListItemDecorator>
      System message
      <Switch checked={showSystemMessages} onChange={handleSystemMessagesToggle} sx={{ ml: 'auto' }} />
    </MenuItem>

    <ListDivider />

    <MenuItem disabled={disabled} onClick={handleConversationPublish}>
      <ListItemDecorator>
        {/*<Badge size='sm' color='primary'>*/}
        <ExitToAppIcon />
        {/*</Badge>*/}
      </ListItemDecorator>
      Share via paste.gg
    </MenuItem>

    <MenuItem disabled={disabled} onClick={handleConversationDownload}>
      <ListItemDecorator>
        <FileDownloadIcon />
      </ListItemDecorator>
      Export conversation
    </MenuItem>

    <ListDivider />

    <MenuItem disabled={disabled} onClick={handleToggleMessageSelectionMode}>
      <ListItemDecorator>{props.isMessageSelectionMode ? <CheckBoxOutlinedIcon /> : <CheckBoxOutlineBlankOutlinedIcon />}</ListItemDecorator>
      <span style={props.isMessageSelectionMode ? { fontWeight: 800 } : {}}>
        Cleanup ...
      </span>
    </MenuItem>

    <MenuItem disabled={disabled} onClick={handleConversationClear}>
      <ListItemDecorator><ClearIcon /></ListItemDecorator>
      Clear conversation
    </MenuItem>

  </>;
}