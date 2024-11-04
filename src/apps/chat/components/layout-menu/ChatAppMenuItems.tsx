import * as React from 'react';

import { Box, Button, IconButton, ListDivider, ListItem, ListItemDecorator, MenuItem, Switch, Tooltip } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import CheckBoxOutlineBlankOutlinedIcon from '@mui/icons-material/CheckBoxOutlineBlankOutlined';
import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined';
import CompressIcon from '@mui/icons-material/Compress';
import EngineeringIcon from '@mui/icons-material/Engineering';
import ForkRightIcon from '@mui/icons-material/ForkRight';
import HorizontalSplitIcon from '@mui/icons-material/HorizontalSplit';
import HorizontalSplitOutlinedIcon from '@mui/icons-material/HorizontalSplitOutlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SettingsSuggestOutlinedIcon from '@mui/icons-material/SettingsSuggestOutlined';
import VerticalSplitIcon from '@mui/icons-material/VerticalSplit';
import VerticalSplitOutlinedIcon from '@mui/icons-material/VerticalSplitOutlined';

import { devMode_AixLastDispatchRequest } from '~/modules/aix/client/ContentReassembler';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { optimaCloseAppMenu } from '~/common/layout/optima/useOptima';
import { useLabsDevMode } from '~/common/state/store-ux-labs';

import { useChatShowSystemMessages } from '../../store-app-chat';
import { usePaneDuplicateOrClose } from '../panes/usePanesManager';


const listItemButtonSx = {
  justifyContent: 'space-between',
};


export function ChatAppMenuItems(props: {
  isMobile: boolean,
  conversationId: DConversationId | null,
  disableItems: boolean,
  hasConversations: boolean,
  isMessageSelectionMode: boolean,
  onConversationBranch: (conversationId: DConversationId, messageId: string | null, addSplitPane: boolean) => void,
  onConversationClear: (conversationId: DConversationId) => void,
  onConversationFlatten: (conversationId: DConversationId) => void,
  // onConversationNew: (forceNoRecycle: boolean) => void,
  setIsMessageSelectionMode: (isMessageSelectionMode: boolean) => void,
}) {

  // external state
  const { canAddPane, isMultiPane, duplicateFocusedPane, removeOtherPanes } = usePaneDuplicateOrClose();
  const [showSystemMessages, setShowSystemMessages] = useChatShowSystemMessages();
  const labsDevMode = useLabsDevMode();


  const handleIncreaseMultiPane = React.useCallback((event?: React.MouseEvent) => {
    event?.stopPropagation();

    // create a new pane with the current conversation
    duplicateFocusedPane();

    // load a brand new conversation inside
    // FIXME: still testing this
    // props.onConversationNew(true);
  }, [duplicateFocusedPane]);

  const handleToggleMultiPane = React.useCallback((_event: React.MouseEvent) => {
    if (isMultiPane)
      removeOtherPanes();
    else
      handleIncreaseMultiPane(undefined);
  }, [handleIncreaseMultiPane, isMultiPane, removeOtherPanes]);


  const closeMenu = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    optimaCloseAppMenu();
  }, []);

  const handleConversationRestart = (event: React.MouseEvent<HTMLDivElement>) => {
    closeMenu(event);
    props.conversationId && props.onConversationClear(props.conversationId);
  };

  const handleConversationBranch = (event: React.MouseEvent<HTMLDivElement>) => {
    closeMenu(event);
    props.conversationId && props.onConversationBranch(props.conversationId, null, true);
  };

  const handleConversationFlatten = (event: React.MouseEvent<HTMLElement>) => {
    closeMenu(event);
    props.conversationId && props.onConversationFlatten(props.conversationId);
  };

  const handleToggleMessageSelectionMode = (event: React.MouseEvent) => {
    closeMenu(event);
    props.setIsMessageSelectionMode(!props.isMessageSelectionMode);
  };

  const handleToggleSystemMessages = () => setShowSystemMessages(!showSystemMessages);


  // [DEV MODE]

  const [devModeDialog, setDevModeDialog] = React.useState<React.ReactNode | null>(null);

  const handleAixShowLastRequest = React.useCallback(() => {
    setDevModeDialog((
      <GoodModal
        open
        dividers
        onClose={() => setDevModeDialog(null)}
        title='Aix: Last Dispach Request Body'
        sx={{ minWidth: '80vw', maxWidth: undefined, overflow: 'hidden' }}
      >
        {devMode_AixLastDispatchRequest ? (
          <Box sx={{
            m: 'calc(-1 * var(--Card-padding))',
            p: 'calc(0.5 * var(--Card-padding))',
            fontSize: 'sm',
            display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 1,
            overflow: 'auto',
          }}>
            <div>Url</div>
            <div style={{ whiteSpace: 'break-spaces' }}>{devMode_AixLastDispatchRequest.url}</div>
            <div>Headers</div>
            <div style={{ whiteSpace: 'break-spaces' }}>{devMode_AixLastDispatchRequest.headers}</div>
            <div>Body</div>
            <div style={{ whiteSpace: 'break-spaces' }}>{devMode_AixLastDispatchRequest.body}</div>
            {devMode_AixLastDispatchRequest.particles.map(((particleString, idx) => (
              <React.Fragment key={idx}>
                <div>Particle {idx + 1}</div>
                <div style={{ whiteSpace: 'break-spaces' }}>{particleString}</div>
              </React.Fragment>
            )))}
          </Box>
        ) : 'Contents will be shown after the next request.'}
      </GoodModal>
    ));
  }, []);


  return <>

    <MenuItem onClick={handleToggleSystemMessages}>
      <ListItemDecorator><SettingsSuggestOutlinedIcon /></ListItemDecorator>
      System Instructions
      <Switch checked={showSystemMessages} onChange={handleToggleSystemMessages} sx={{ ml: 'auto' }} />
    </MenuItem>

    {/* Pane management: Un/Split */}
    <MenuItem onClick={handleToggleMultiPane}>
      <ListItemDecorator>{props.isMobile
        ? (isMultiPane ? <HorizontalSplitIcon /> : <HorizontalSplitOutlinedIcon />)
        : (isMultiPane ? <VerticalSplitIcon /> : <VerticalSplitOutlinedIcon />)
      }</ListItemDecorator>
      {/* Unsplit / Split text*/}
      {isMultiPane ? 'Unsplit' : props.isMobile ? 'Split Down' : 'Split Right'}
      {/* '+' */}
      {isMultiPane && (
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

    <ListDivider />

    {/*<MenuItem disabled={props.disableItems} onClick={handleToggleMessageSelectionMode} sx={props.isMessageSelectionMode ? { fontWeight: 'lg' } : {}}>*/}
    {/*  <ListItemDecorator>{props.isMessageSelectionMode ? <CheckBoxOutlinedIcon /> : <CheckBoxOutlineBlankOutlinedIcon />}</ListItemDecorator>*/}
    {/*  Cleanup ...*/}
    {/*</MenuItem>*/}

    <ListItem>
      <Button
        fullWidth
        size='md'
        color={props.isMessageSelectionMode ? 'warning' : 'neutral'}
        variant={props.isMessageSelectionMode ? 'solid' : 'plain'}
        endDecorator={props.isMessageSelectionMode ? <CheckBoxOutlinedIcon /> : <CheckBoxOutlineBlankOutlinedIcon />}
        onClick={handleToggleMessageSelectionMode}
        sx={listItemButtonSx}
      >
        Cleanup
      </Button>
    </ListItem>

    {/*<MenuItem disabled={props.disableItems} onClick={handleConversationFlatten}>*/}
    {/*  <ListItemDecorator><CompressIcon color='success' /></ListItemDecorator>*/}
    {/*  Compress ...*/}
    {/*</MenuItem>*/}

    <ListItem>
      <Button
        fullWidth
        size='md'
        color='neutral'
        variant='plain'
        endDecorator={<CompressIcon />}
        onClick={handleConversationFlatten}
        sx={listItemButtonSx}
      >
        Compress ...
      </Button>
    </ListItem>


    {labsDevMode && <ListDivider />}

    {labsDevMode && (
      <MenuItem onClick={handleAixShowLastRequest}>
        <ListItemDecorator><EngineeringIcon /></ListItemDecorator>
        AIX: Show Last Request...
      </MenuItem>
    )}

    {/* [DEV MODE] Show any dialog, if present */}
    {devModeDialog}

  </>;
}