import * as React from 'react';

import { Box, IconButton, ListItemDecorator, MenuItem, Option, Select, Switch, Tooltip, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined';
import CleaningServicesOutlinedIcon from '@mui/icons-material/CleaningServicesOutlined';
import CompressIcon from '@mui/icons-material/Compress';
import EngineeringIcon from '@mui/icons-material/Engineering';
import ForkRightIcon from '@mui/icons-material/ForkRight';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SettingsSuggestOutlinedIcon from '@mui/icons-material/SettingsSuggestOutlined';

import { devMode_AixLastDispatchRequest } from '~/modules/aix/client/ContentReassembler';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import { CodiconSplitHorizontal } from '~/common/components/icons/CodiconSplitHorizontal';
import { CodiconSplitHorizontalRemove } from '~/common/components/icons/CodiconSplitHorizontalRemove';
import { CodiconSplitVertical } from '~/common/components/icons/CodiconSplitVertical';
import { CodiconSplitVerticalRemove } from '~/common/components/icons/CodiconSplitVerticalRemove';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { OptimaPanelGroup, OptimaPanelGroupGutter } from '~/common/layout/optima/panel/OptimaPanelGroup';
import { optimaCloseAppMenu } from '~/common/layout/optima/useOptima';
import { useLabsDevMode } from '~/common/state/store-ux-labs';

import { useChatShowSystemMessages } from '../../store-app-chat';
import { usePaneDuplicateOrClose } from '../panes/usePanesManager';


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
  const { canAddPane, isMultiPane, duplicateFocusedPane, removeOtherPanes } = usePaneDuplicateOrClose();
  const [showSystemMessages, setShowSystemMessages] = useChatShowSystemMessages();
  const labsDevMode = useLabsDevMode();


  // handlers

  const closeMenu = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    optimaCloseAppMenu();
  }, []);


  // Window

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


  // Actions

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
        open={true}
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

    {/* Window group */}
    <OptimaPanelGroup title='Window'>

      <MenuItem onClick={handleToggleMultiPane}>
        <ListItemDecorator>{props.isVerticalSplit
          ? (isMultiPane ? <CodiconSplitVerticalRemove /> : <CodiconSplitVertical />)
          : (isMultiPane ? <CodiconSplitHorizontalRemove /> : <CodiconSplitHorizontal />)
        }</ListItemDecorator>
        {/* Unsplit / Split text*/}
        {props.isVerticalSplit
          ? (isMultiPane ? 'Unsplit' : 'Split Down')
          : (isMultiPane ? 'Unsplit' : 'Split Right')
        }
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

    </OptimaPanelGroup>

    {/* Chat Actions group */}
    <OptimaPanelGroup title='Actions'>

      <MenuItem disabled={props.disableItems} onClick={handleConversationBranch}>
        <ListItemDecorator><ForkRightIcon /></ListItemDecorator>
        Branch
      </MenuItem>

      <MenuItem
        disabled={props.disableItems}
        color={props.isMessageSelectionMode ? 'warning' : 'neutral'}
        variant={props.isMessageSelectionMode ? 'solid' : 'plain'}
        onClick={handleToggleMessageSelectionMode}
        sx={props.isMessageSelectionMode ? { fontWeight: 'lg' } : {}}
      >
        <ListItemDecorator>{!props.isMessageSelectionMode ? <CleaningServicesOutlinedIcon /> : <CheckBoxOutlinedIcon />}</ListItemDecorator>
        Cleanup
      </MenuItem>

      <MenuItem disabled={props.disableItems} onClick={handleConversationFlatten}>
        <ListItemDecorator><CompressIcon /></ListItemDecorator>
        Minify
      </MenuItem>

      <MenuItem disabled={props.disableItems} onClick={handleConversationRestart}>
        <ListItemDecorator><RestartAltIcon /></ListItemDecorator>
        <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'space-between', gap: 1 }}>
          Restart
          {/*{!props.disableItems && <KeyStroke combo='Ctrl + Shift + X' />}*/}
        </Box>
      </MenuItem>
    </OptimaPanelGroup>

    {/* ... how do we name this? ... */}
    <OptimaPanelGroup title='Persona'>
      <MenuItem onClick={handleToggleSystemMessages}>
        <ListItemDecorator><SettingsSuggestOutlinedIcon /></ListItemDecorator>
        System Instruction
        <Switch size='md' checked={showSystemMessages} onChange={handleToggleSystemMessages} sx={{ ml: 'auto' }} />
      </MenuItem>
    </OptimaPanelGroup>

    {/* [DEV] Development */}
    {labsDevMode && (
      <OptimaPanelGroup title='[Developers]'>
        <MenuItem onClick={handleAixShowLastRequest}>
          <ListItemDecorator><EngineeringIcon /></ListItemDecorator>
          AIX: Show Last Request...
        </MenuItem>
      </OptimaPanelGroup>
    )}

    {/* [DEV MODE] Show any dialog, if present */}
    {devModeDialog}

  </>;
}