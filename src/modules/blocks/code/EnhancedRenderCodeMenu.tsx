import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { ListDivider, ListItemDecorator, MenuItem } from '@mui/joy';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { CloseableMenu } from '~/common/components/CloseableMenu';
import { ConfirmationModal } from '~/common/components/ConfirmationModal';
import { useLabsDevMode, useUXLabsStore } from '~/common/state/store-ux-labs';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';

import { getCodeCollapseManager } from './codeCollapseManager';


/**
 * Small hidden context menu to toggle the code enhancer, globally.
 */
export function EnhancedRenderCodeMenu(props: {
  anchor: HTMLElement,
  onClose: () => void,
  isCollapsed: boolean,
  onToggleCollapse: () => void,
}) {

  // state
  const { showPromisedOverlay } = useOverlayComponents();
  const labsDevMode = useLabsDevMode();
  const { labsEnhanceCodeBlocks, labsEnhanceCodeLiveFile, setLabsEnhanceCodeBlocks, setLabsEnhanceCodeLiveFile } = useUXLabsStore(useShallow(state => ({
    labsEnhanceCodeBlocks: state.labsEnhanceCodeBlocks,
    labsEnhanceCodeLiveFile: state.labsEnhanceCodeLiveFile,
    setLabsEnhanceCodeBlocks: state.setLabsEnhanceCodeBlocks,
    setLabsEnhanceCodeLiveFile: state.setLabsEnhanceCodeLiveFile,
  })));


  // handlers

  const handleCollapseAllCodeBlocks = React.useCallback(() => {
    getCodeCollapseManager().triggerCollapseAll(true);
  }, []);

  const handleExpandAllCodeBlocks = React.useCallback(() => {
    getCodeCollapseManager().triggerCollapseAll(false);
  }, []);

  const toggleEnhanceCodeBlocks = React.useCallback(() => {
    // turn blocks on (may not even be called, ever)
    if (!labsEnhanceCodeBlocks) {
      setLabsEnhanceCodeBlocks(true);
      return;
    }
    // ask to turn the blocks off
    showPromisedOverlay('blocks-off-enhance-code', {}, ({ onResolve, onUserReject }) =>
      <ConfirmationModal
        open onClose={onUserReject} onPositive={() => onResolve(true)}
        title='Turn off enhanced code blocks?'
        confirmationText='This will disable LiveFile functionality. You can turn it back on anytime by going to Settings > Labs > Enhance Legacy Code.'
        positiveActionText='Turn Off'
      />,
    ).then(() => setLabsEnhanceCodeBlocks(false)).catch(() => null /* ignore closure */);
  }, [labsEnhanceCodeBlocks, setLabsEnhanceCodeBlocks, showPromisedOverlay]);

  const toggleEnhanceCodeLiveFile = React.useCallback(() => {
    setLabsEnhanceCodeLiveFile(!labsEnhanceCodeLiveFile);
  }, [labsEnhanceCodeLiveFile, setLabsEnhanceCodeLiveFile]);


  return (
    <CloseableMenu
      open={true} dense
      anchorEl={props.anchor} onClose={props.onClose}
      placement='bottom-end'
      sx={{ minWidth: 250 }}
    >

      <MenuItem onClick={props.onToggleCollapse}>
        <ListItemDecorator>{props.isCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}</ListItemDecorator>
        {/*<ListItemDecorator />*/}
        {props.isCollapsed ? 'Expand' : 'Collapse'}
      </MenuItem>

      <MenuItem onClick={props.isCollapsed ? handleExpandAllCodeBlocks : handleCollapseAllCodeBlocks}>
        <ListItemDecorator />
        {props.isCollapsed ? 'Expand' : 'Collapse'} All Blocks
      </MenuItem>

      <ListDivider />

      <MenuItem onClick={toggleEnhanceCodeLiveFile}>
        <ListItemDecorator>{labsEnhanceCodeLiveFile && <CheckRoundedIcon />}</ListItemDecorator>
        Enable LiveFile
      </MenuItem>

      {labsDevMode && (
        // A mix in between UxLabsSettings (labsEnhanceCodeBlocks) and the ChatDrawer MenuItems
        <MenuItem onClick={toggleEnhanceCodeBlocks}>
          <ListItemDecorator>{labsEnhanceCodeBlocks && <CheckRoundedIcon />}</ListItemDecorator>
          [DEV] Enhanced Blocks
        </MenuItem>
      )}

    </CloseableMenu>
  );
}